import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "crypto";
import { Redis } from "ioredis";
import { In, Repository } from "typeorm";
import { REDIS_CLIENT } from "../redis/redis.module";
import { PlatformConfigCache } from "../platform-config/platform-config.cache";
import { OAuthProvider, User, UserRole } from "../user/user.entity";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { TwoFactorService } from "./two-factor.service";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL = 60 * 60; // 1 heure
const EMAIL_VERIFY_TTL = 24 * 60 * 60; // 24 heures
// Court délai avant expiration du code d'échange OAuth — le temps d'une
// redirection navigateur, pas plus (usage unique de toute façon).
const OAUTH_EXCHANGE_TTL = 60;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
    private readonly twoFactorService: TwoFactorService,
    private readonly platformConfig: PlatformConfigCache,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new RpcException({
        statusCode: 409,
        message: "Email déjà utilisé",
      });
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash,
      first_name: dto.first_name,
      last_name: dto.last_name,
      phone: dto.phone ?? null,
      role: dto.role ?? UserRole.BUYER,
    });

    await this.userRepo.save(user);

    const verifyToken = randomUUID();
    await this.redis.set(
      `email_verify:${verifyToken}`,
      user.id,
      "EX",
      EMAIL_VERIFY_TTL,
    );

    this.notifClient.emit("notification.welcome", {
      email: user.email,
      firstName: user.first_name,
    });

    this.notifClient.emit("notification.email_verification", {
      email: user.email,
      firstName: user.first_name,
      token: verifyToken,
    });

    return {
      ...this.generateTokens(user),
      user: this.sanitize(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.email = :email", { email: dto.email })
      .getOne();

    if (!user) {
      throw new RpcException({
        statusCode: 401,
        message: "Identifiants invalides",
      });
    }
    if (!user.is_active) {
      throw new RpcException({ statusCode: 403, message: "Compte désactivé" });
    }
    if (user.is_suspended) {
      throw new RpcException({ statusCode: 403, message: "Compte suspendu" });
    }

    // CDC §10.3 : rate limiting par IP (throttler global côté gateway) ET par
    // compte — ce second volet manquait entièrement. Vérifié avant le mot de
    // passe : un compte verrouillé reste bloqué même avec les bons
    // identifiants, tant que le verrou n'a pas expiré.
    if (user.locked_until && user.locked_until > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.locked_until.getTime() - Date.now()) / 60000,
      );
      throw new RpcException({
        statusCode: 429,
        message: `Compte temporairement verrouillé suite à trop de tentatives échouées — réessayez dans ${remainingMinutes} min`,
      });
    }

    if (!user.password_hash) {
      throw new RpcException({
        statusCode: 401,
        message: "Connexion via OAuth requise",
      });
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      await this.registerFailedLoginAttempt(user);
      throw new RpcException({
        statusCode: 401,
        message: "Identifiants invalides",
      });
    }

    // CDC §2.2 : le compte doit être activé via le lien envoyé par email
    // avant tout accès. Vérifié seulement après le mot de passe (pas avant)
    // pour ne pas révéler le statut de vérification à qui ne connaît pas
    // déjà le mot de passe. Les comptes OAuth ont is_email_verified=true
    // dès la création (email déjà vérifié par Google/Facebook).
    if (!user.is_email_verified) {
      throw new RpcException({
        statusCode: 403,
        message: "Adresse e-mail non vérifiée — consultez vos e-mails pour activer votre compte",
      });
    }

    if (user.two_factor_enabled) {
      if (!dto.two_factor_code) {
        return { requires_2fa: true, two_factor_method: user.two_factor_method };
      }
      const validCode = await this.twoFactorService.verify(
        user.id,
        dto.two_factor_code,
      );
      if (!validCode) {
        await this.registerFailedLoginAttempt(user);
        throw new RpcException({
          statusCode: 401,
          message: "Code 2FA invalide",
        });
      }
    }

    if (user.failed_login_attempts > 0 || user.locked_until) {
      await this.userRepo.update(user.id, {
        failed_login_attempts: 0,
        locked_until: null,
      });
      // Reflète immédiatement le reset dans la réponse — sans ça, l'objet
      // `user` en mémoire (chargé avant l'update ci-dessus) renvoyait encore
      // l'ancien compteur au client malgré une base déjà correcte.
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /**
   * Incrémente le compteur d'échecs (mot de passe ou code 2FA invalide) et
   * verrouille temporairement le compte au-delà du seuil configurable
   * (platform_settings, jamais de valeur en dur).
   */
  private async registerFailedLoginAttempt(user: User): Promise<void> {
    const config = await this.platformConfig.get();
    const attempts = user.failed_login_attempts + 1;
    const locked_until =
      attempts >= config.account_lockout_threshold
        ? new Date(Date.now() + config.account_lockout_duration_minutes * 60000)
        : null;

    await this.userRepo.update(user.id, {
      failed_login_attempts: attempts,
      locked_until,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string; jti: string; exp: number };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new RpcException({
        statusCode: 401,
        message: "Refresh token invalide ou expiré",
      });
    }

    const blacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new RpcException({
        statusCode: 401,
        message: "Refresh token révoqué",
      });
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 401,
        message: "Utilisateur introuvable ou suspendu",
      });
    }

    // Rotation : l'ancien refresh token est immédiatement blacklisté — un
    // jeton volé ne peut donc servir qu'une seule fois avant que le
    // titulaire légitime (qui continue son usage normal) ne le révoque de
    // fait à son prochain refresh.
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${payload.jti}`, "1", "EX", ttl);
    }

    return this.generateTokens(user);
  }

  async logout(dto: RefreshTokenDto) {
    let payload: { jti?: string; exp?: number };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      // Token invalide, forgé ou déjà expiré — rien à révoquer, la
      // déconnexion côté client suffit ; on ne fait jamais confiance à un
      // payload non vérifié pour décider quoi blacklister.
      return { success: true };
    }

    if (payload.jti && payload.exp) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.set(`blacklist:${payload.jti}`, "1", "EX", ttl);
      }
    }
    return { success: true };
  }

  async oauthLogin(data: {
    provider: OAuthProvider;
    oauth_id: string;
    email: string;
    first_name: string;
    last_name: string;
  }) {
    if (!data.email) {
      // Sans email, la recherche par email ci-dessous ferait correspondre
      // n'importe quel autre compte sans email (collision sur chaîne vide),
      // et la contrainte UNIQUE sur `email` casserait toute création
      // suivante. La billetterie dépend entièrement de l'email (envoi des
      // billets) : un compte sans email n'est de toute façon pas exploitable.
      throw new RpcException({
        statusCode: 400,
        message:
          "Votre compte " +
          data.provider +
          " ne fournit pas d'adresse email accessible. Vérifiez qu'un email est confirmé sur votre compte, ou inscrivez-vous avec email et mot de passe.",
      });
    }

    let user = await this.userRepo.findOne({
      where: { oauth_provider: data.provider, oauth_id: data.oauth_id },
    });

    if (!user) {
      // Vérifier si l'email existe déjà (liaison de compte)
      user = await this.userRepo.findOne({ where: { email: data.email } });
      if (user) {
        user.oauth_provider = data.provider;
        user.oauth_id = data.oauth_id;
        await this.userRepo.save(user);
      } else {
        user = this.userRepo.create({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          oauth_provider: data.provider,
          oauth_id: data.oauth_id,
          is_email_verified: true,
          email_verified_at: new Date(),
          role: UserRole.BUYER,
        });
        await this.userRepo.save(user);
      }
    }

    if (!user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 403,
        message: "Compte suspendu ou désactivé",
      });
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /**
   * Après un callback OAuth réussi, on ne redirige jamais avec les tokens en
   * clair dans l'URL (historique navigateur, logs proxy, header Referer) —
   * on stocke les tokens sous un code opaque à usage unique et courte durée
   * de vie, échangé ensuite côté serveur via exchangeOAuthCode().
   */
  async createOAuthExchangeCode(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<string> {
    const code = randomBytes(32).toString("hex");
    await this.redis.set(
      `oauth_exchange:${code}`,
      JSON.stringify(tokens),
      "EX",
      OAUTH_EXCHANGE_TTL,
    );
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<{ access_token: string; refresh_token: string }> {
    const key = `oauth_exchange:${code}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new RpcException({
        statusCode: 400,
        message: "Code d'échange invalide ou expiré",
      });
    }
    await this.redis.del(key); // usage unique
    return JSON.parse(raw);
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        role: UserRole;
      }>(token, { secret: this.config.get<string>("JWT_ACCESS_SECRET") });
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new RpcException({
        statusCode: 401,
        message: "Token invalide ou expiré",
      });
    }
  }

  /**
   * Renvoi du lien de vérification d'email — nécessaire depuis que login()
   * bloque les comptes non vérifiés (CDC §2.2) : sans cette route, un lien
   * expiré (TTL 24h) ou jamais reçu laissait le compte bloqué sans recours.
   */
  async resendVerificationEmail(dto: { email: string }) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    // Ne pas révéler si l'email existe ou non (même pattern que forgotPassword)
    if (!user || user.is_email_verified) return { success: true };

    const verifyToken = randomUUID();
    await this.redis.set(
      `email_verify:${verifyToken}`,
      user.id,
      "EX",
      EMAIL_VERIFY_TTL,
    );

    this.notifClient.emit("notification.email_verification", {
      email: user.email,
      firstName: user.first_name,
      token: verifyToken,
    });

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    // Ne pas révéler si l'email existe ou non
    if (!user) return { success: true };

    const token = randomUUID();
    await this.redis.set(
      `reset_password:${token}`,
      user.id,
      "EX",
      RESET_TOKEN_TTL,
    );

    this.notifClient.emit("notification.password_reset", {
      email: user.email,
      firstName: user.first_name,
      token,
    });

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.redis.get(`reset_password:${dto.token}`);
    if (!userId) {
      throw new RpcException({
        statusCode: 400,
        message: "Token invalide ou expiré",
      });
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    }

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.userRepo.save(user);
    await this.redis.del(`reset_password:${dto.token}`);

    // CDC §10.3 : audit trail de toutes les actions sensibles, pas seulement
    // celles de l'admin. Fire-and-forget — un échec de journalisation ne
    // doit jamais faire échouer le reset lui-même.
    this.adminClient
      .send("admin.log_action", {
        action: "USER_PASSWORD_RESET",
        entity_type: "USER",
        entity_id: user.id,
        performed_by: user.id,
        reason: "Réinitialisation du mot de passe via lien email par le titulaire du compte",
      })
      .subscribe({ error: () => undefined });

    return { success: true };
  }

  /**
   * Modification du mot de passe depuis le profil, par le titulaire du
   * compte déjà connecté — distinct de resetPassword() (lien email, compte
   * non accessible). L'ancien mot de passe est requis pour confirmer.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id: userId })
      .getOne();

    if (!user) {
      throw new RpcException({ statusCode: 404, message: "Utilisateur introuvable" });
    }
    if (!user.password_hash) {
      throw new RpcException({
        statusCode: 400,
        message: "Ce compte utilise une connexion Google/Facebook — aucun mot de passe à modifier",
      });
    }

    const valid = await bcrypt.compare(dto.current_password, user.password_hash);
    if (!valid) {
      throw new RpcException({ statusCode: 400, message: "Mot de passe actuel incorrect" });
    }

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.userRepo.save(user);

    // CDC §10.3 : audit trail de toutes les actions sensibles, pas seulement
    // celles de l'admin. Fire-and-forget — un échec de journalisation ne
    // doit jamais faire échouer le changement lui-même.
    this.adminClient
      .send("admin.log_action", {
        action: "USER_PASSWORD_RESET",
        entity_type: "USER",
        entity_id: user.id,
        performed_by: user.id,
        reason: "Mot de passe modifié depuis le profil par le titulaire du compte",
      })
      .subscribe({ error: () => undefined });

    return { success: true };
  }

  async getUserById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    return this.sanitize(user);
  }

  /** Résolution par lot (ex. newsletter) — évite un aller-retour par utilisateur. */
  async getUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const users = await this.userRepo.findBy({ id: In(ids) });
    return users.map((u) => this.sanitize(u));
  }

  /** Répartition des comptes par rôle + nombre de suspensions — utilisé par le dashboard KPIs admin. */
  async getUserStats(): Promise<{
    by_role: Record<string, number>;
    suspended_count: number;
    total: number;
  }> {
    const rows = await this.userRepo
      .createQueryBuilder("u")
      .select("u.role", "role")
      .addSelect("COUNT(*)", "count")
      .groupBy("u.role")
      .getRawMany<{ role: string; count: string }>();

    const by_role: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      by_role[row.role] = parseInt(row.count, 10);
      total += by_role[row.role];
    }

    const suspended_count = await this.userRepo.count({
      where: { is_suspended: true },
    });

    return { by_role, suspended_count, total };
  }

  async verifyEmail(token: string) {
    const userId = await this.redis.get(`email_verify:${token}`);
    if (!userId) {
      throw new RpcException({
        statusCode: 400,
        message: "Token de vérification invalide ou expiré",
      });
    }

    await this.userRepo.update(userId, { is_email_verified: true });
    await this.redis.del(`email_verify:${token}`);

    return { success: true };
  }

  async suspendUser(id: string, adminId: string, reason: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });

    user.is_suspended = true;
    user.suspension_reason = reason;
    user.suspended_at = new Date();
    user.suspended_by = adminId;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  async unsuspendUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });

    user.is_suspended = false;
    user.suspension_reason = null;
    user.suspended_at = null;
    user.suspended_by = null;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /**
   * Bug corrigé : POST /admin/users/:id/unlock appelait déjà auth.unlock_account
   * côté gateway (avec son propre audit trail USER_ACCOUNT_UNLOCKED déjà en
   * place), mais aucun handler ne répondait à ce pattern ici — timeout RPC
   * garanti, la route était en réalité entièrement cassée.
   */
  async unlockAccount(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });

    user.failed_login_attempts = 0;
    user.locked_until = null;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /**
   * Bug corrigé : même problème que unlockAccount() — POST
   * /admin/users/:id/activate appelait auth.activate_account, jamais géré
   * côté auth-service.
   */
  async activateAccount(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    if (user.is_email_verified) {
      throw new RpcException({
        statusCode: 400,
        message: "Ce compte est déjà activé",
      });
    }

    user.is_email_verified = true;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  async changeRole(id: string, role: UserRole) {
    if (!Object.values(UserRole).includes(role)) {
      throw new RpcException({ statusCode: 400, message: "Rôle invalide" });
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });

    user.role = role;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /**
   * Bascule self-service BUYER→ORGANIZER, déclenchée par la gateway juste
   * après la création du profil organisateur (bug corrigé : jusqu'ici,
   * seul un admin pouvait faire cette bascule via changeRole() — aucune
   * route self-service n'existait). Distincte de changeRole() à dessein :
   * changeRole() sert aussi l'admin pour modifier le rôle d'un AUTRE
   * utilisateur, et ne doit jamais renvoyer les tokens de la cible à
   * l'appelant (fuite de session) — ici l'utilisateur agit sur lui-même,
   * de nouveaux tokens (rôle à jour) sont donc légitimes et nécessaires.
   */
  async selfUpgradeToOrganizer(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({ statusCode: 404, message: "Utilisateur introuvable" });
    }
    if (user.role !== UserRole.BUYER) {
      throw new RpcException({
        statusCode: 409,
        message: "Seul un compte Acheteur peut devenir Organisateur via cette action",
      });
    }

    user.role = UserRole.ORGANIZER;
    await this.userRepo.save(user);

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /** Recherche/liste paginée des comptes — admin uniquement. */
  async listUsers(filters: {
    q?: string;
    role?: UserRole;
    is_suspended?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ReturnType<AuthService["sanitize"]>[]; total: number }> {
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = filters.offset ?? 0;

    const qb = this.userRepo
      .createQueryBuilder("u")
      // createQueryBuilder ne filtre pas automatiquement deleted_at
      // (contrairement à find()/findOne()) — exclusion explicite des
      // comptes supprimés (RGPD) des résultats de recherche admin.
      .where("u.deleted_at IS NULL")
      .orderBy("u.created_at", "DESC")
      .skip(offset)
      .take(limit);

    if (filters.q) {
      qb.andWhere(
        "(LOWER(u.email) LIKE :q OR LOWER(u.first_name) LIKE :q OR LOWER(u.last_name) LIKE :q)",
        { q: `%${filters.q.toLowerCase()}%` },
      );
    }
    if (filters.role) qb.andWhere("u.role = :role", { role: filters.role });
    if (filters.is_suspended !== undefined) {
      qb.andWhere("u.is_suspended = :is_suspended", {
        is_suspended: filters.is_suspended,
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data: data.map((user) => this.sanitize(user)), total };
  }

  /**
   * Droit à l'effacement RGPD — anonymise les données personnelles (email,
   * nom, téléphone, 2FA, OAuth) et pose un soft-delete. Les commandes/billets
   * référençant cet ID sont conservés ailleurs (comptabilité, preuve d'accès
   * événement) mais anonymisés séparément par user-service ; cette méthode
   * ne gère que le compte lui-même. La vérification des obligations en cours
   * (événements à venir, reversements en attente) est faite par l'appelant
   * (api-gateway), qui seul a la vue sur les autres microservices.
   */
  async deleteAccount(
    id: string,
    password?: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id })
      .getOne();

    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    }

    if (user.password_hash) {
      if (!password) {
        throw new RpcException({
          statusCode: 400,
          message: "Mot de passe requis pour confirmer la suppression",
        });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new RpcException({
          statusCode: 401,
          message: "Mot de passe incorrect",
        });
      }
    }

    await this.userRepo.update(id, {
      email: `deleted-${id}@billetix.invalid`,
      first_name: "Compte",
      last_name: "supprimé",
      phone: null,
      password_hash: null,
      two_factor_enabled: false,
      two_factor_method: null,
      two_factor_secret: null,
      oauth_provider: null,
      oauth_id: null,
      is_active: false,
    });
    await this.userRepo.softDelete(id);

    return { success: true };
  }

  // --- Helpers ---

  private generateTokens(user: User): {
    access_token: string;
    refresh_token: string;
  } {
    const jti = randomUUID();

    const access_token = this.signAccess(user);

    const refresh_token = this.jwtService.sign(
      { sub: user.id, jti },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d",
      },
    );

    return { access_token, refresh_token };
  }

  private signAccess(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
      },
    );
  }

  private sanitize(user: User) {
    const { password_hash, ...safe } = user as User & {
      password_hash?: string;
    };
    return safe;
  }
}
