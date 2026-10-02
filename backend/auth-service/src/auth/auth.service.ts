import { isUUID } from "class-validator";
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
import { assertCanManageTarget } from "./assert-can-manage-target";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ageInYears } from "./age";
import { getPasswordViolations, PasswordPersonalInfo } from "./password-policy";
import { TwoFactorService } from "./two-factor.service";

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL = 60 * 60; // 1 heure
// Lien de changement remis à la connexion quand le mot de passe a expiré : à utiliser aussitôt.
const PASSWORD_EXPIRED_TOKEN_TTL = 15 * 60;

/** Mot de passe plus ancien que la durée réglée (0 = jamais) ; sans date connue, celle de création du compte. */
export function isPasswordExpired(
  user: { password_changed_at?: Date | null; created_at?: Date },
  maxAgeDays: number | undefined,
  now = new Date(),
): boolean {
  if (!maxAgeDays || maxAgeDays <= 0) return false;
  const since = user.password_changed_at ?? user.created_at;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}
const EMAIL_VERIFY_TTL = 24 * 60 * 60; // 24 heures
// Court délai avant expiration du code d'échange OAuth — le temps d'une
// redirection navigateur, pas plus (usage unique de toute façon).
const OAUTH_EXCHANGE_TTL = 60;
// Plus long que OAUTH_EXCHANGE_TTL : laisse le temps de saisir un code TOTP.
const OAUTH_2FA_PENDING_TTL = 300;
// Le temps de saisir sa date de naissance à la première connexion
// Google/Facebook — au-delà, il suffit de relancer la connexion.
const OAUTH_BIRTH_DATE_PENDING_TTL = 15 * 60;

// Deux formes possibles selon que le compte a la 2FA activée ou non — voir
// AuthService.oauthLogin().
type OAuthExchangePayload =
  | { access_token: string; refresh_token: string }
  | { requires_2fa: true; two_factor_method: string; pending_token: string }
  | { requires_birth_date: true; pending_token: string; first_name: string };

type OAuthProfile = {
  provider: OAuthProvider;
  oauth_id: string;
  email: string;
  first_name: string;
  last_name: string;
};

// pending_token « date de naissance » : compte existant à compléter, ou profil Google/Facebook pas encore créé.
type OAuthBirthDatePending = { user_id: string } | { profile: OAuthProfile };

/** Filtres de la liste admin des comptes. */
export type UserListStatus = "active" | "suspended" | "locked" | "unverified";
export type UserListSort = "recent" | "oldest" | "name";

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

  /** Règles d'inscription affichées en temps réel par le frontend, réglables par l'admin. */
  async getRegistrationPolicy(): Promise<{ password_min_length: number; minimum_age: number }> {
    const { password_min_length, minimum_signup_age } = await this.platformConfig.get();
    return { password_min_length, minimum_age: minimum_signup_age };
  }

  /** Âge minimum (platform_settings), pour l'inscription comme pour la première connexion Google/Facebook. */
  private async assertAllowedBirthDate(birthDate: string): Promise<void> {
    const age = ageInYears(birthDate);
    if (Number.isNaN(age) || age < 0) {
      throw new RpcException({
        statusCode: 400,
        message: "La date de naissance doit être une date passée valide",
      });
    }
    const { minimum_signup_age } = await this.platformConfig.get();
    if (age < minimum_signup_age) {
      throw new RpcException({
        statusCode: 403,
        message: `L'inscription sur BilleTix est réservée aux personnes d'au moins ${minimum_signup_age} ans.`,
      });
    }
  }

  /** Seule source de vérité de la politique de mot de passe (longueur minimale réglable par l'admin). */
  private async assertPasswordPolicy(
    password: string,
    personalInfo: PasswordPersonalInfo,
  ): Promise<void> {
    const { password_min_length } = await this.platformConfig.get();
    const violations = getPasswordViolations(password, password_min_length, personalInfo);
    if (violations.length > 0) {
      throw new RpcException({
        statusCode: 400,
        message: violations.map((v) => `Mot de passe : ${v.toLowerCase()}`),
      });
    }
  }

  /** Le nouveau mot de passe doit différer de l'actuel (sinon le renouvellement n'aurait aucun effet). */
  private async assertNewPasswordDiffers(newPassword: string, currentHash: string | null): Promise<void> {
    if (currentHash && (await bcrypt.compare(newPassword, currentHash))) {
      throw new RpcException({
        statusCode: 400,
        message: "Le nouveau mot de passe doit être différent de l'ancien.",
      });
    }
  }

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

    await this.assertAllowedBirthDate(dto.birth_date);

    await this.assertPasswordPolicy(dto.password, dto);

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email,
      password_hash,
      password_changed_at: new Date(),
      first_name: dto.first_name,
      last_name: dto.last_name,
      birth_date: dto.birth_date,
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

    // L'inscription crée le compte et envoie l'email, sans jeton : l'accès passe par login() une fois l'email vérifié.
    return {
      email_verification_required: true,
      user: this.sanitize(user),
    };
  }

  /** Confirme une action sensible par le mot de passe (mêmes protections qu'à la connexion) ; compte OAuth : has_password false. */
  /** Le compte a-t-il un mot de passe (sinon connexion Google/Facebook uniquement) ? */
  async hasPassword(userId: string): Promise<{ has_password: boolean }> {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id: userId })
      .getOne();
    if (!user) throw new RpcException({ statusCode: 404, message: "Compte introuvable" });
    return { has_password: Boolean(user.password_hash) };
  }

  async verifyPassword(userId: string, password: string): Promise<{ valid: true; has_password: boolean }> {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id: userId })
      .getOne();
    if (!user) throw new RpcException({ statusCode: 404, message: "Compte introuvable" });
    if (!user.password_hash) return { valid: true, has_password: false };
    if (!password) throw new RpcException({ statusCode: 400, message: "Saisissez le mot de passe de votre compte." });
    if (user.locked_until && user.locked_until > new Date()) {
      const remainingMinutes = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
      throw new RpcException({
        statusCode: 429,
        message: `Compte temporairement verrouillé suite à trop de tentatives échouées — réessayez dans ${remainingMinutes} min`,
      });
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      await this.registerFailedLoginAttempt(user);
      // 400 et non 401 : le site traiterait un 401 comme une session expirée.
      throw new RpcException({ statusCode: 400, message: "Mot de passe incorrect." });
    }
    return { valid: true, has_password: true };
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

    // CDC §10.3 : verrouillage par compte, vérifié avant le mot de passe tant que le verrou n'a pas expiré.
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

    // CDC §2.2 : email vérifié obligatoire, contrôlé après le mot de passe pour ne rien révéler.
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
      // Reflète le reset dans la réponse : l'objet user en mémoire a été chargé avant la mise à jour.
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }

    // CNIL : mot de passe trop ancien → aucun jeton de session, seulement un lien de changement à usage unique.
    const { password_max_age_days } = await this.platformConfig.get();
    if (isPasswordExpired(user, password_max_age_days)) {
      const token = randomUUID();
      await this.redis.set(`reset_password:${token}`, user.id, "EX", PASSWORD_EXPIRED_TOKEN_TTL);
      return {
        password_expired: true,
        password_change_token: token,
        password_max_age_days,
      };
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /** Compte les échecs (mot de passe ou 2FA) et verrouille le compte au-delà du seuil réglable. */
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

  /** Durée d'inactivité avant expiration, exposée au frontend (platform_settings). */
  async getSessionPolicy(): Promise<{ idle_timeout_minutes: number; max_duration_hours: number }> {
    const { session_idle_timeout_minutes, session_max_duration_hours } = await this.platformConfig.get();
    return {
      idle_timeout_minutes: session_idle_timeout_minutes,
      max_duration_hours: session_max_duration_hours,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: { sub: string; jti: string; exp: number; iat: number; auth_time?: number };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new RpcException({
        statusCode: 401,
        code: "REFRESH_INVALID",
        message: "Refresh token invalide ou expiré",
      });
    }

    // Deux onglets qui renouvellent avec le même jeton reçoivent la même nouvelle paire pendant un court délai.
    const rotated = await this.redis.get(`rotated:${payload.jti}`);
    if (rotated) {
      const pair = JSON.parse(rotated) as ReturnType<AuthService["generateTokens"]>;
      // Session fermée entre-temps (déconnexion de la nouvelle paire) : le délai de grâce ne la rouvre pas.
      const next = this.jwtService.decode(pair.refresh_token) as { jti?: string } | null;
      if (next?.jti && (await this.redis.get(`blacklist:${next.jti}`))) {
        throw new RpcException({
          statusCode: 401,
          code: "REFRESH_REVOKED",
          message: "Refresh token révoqué",
        });
      }
      return pair;
    }

    const blacklisted = await this.redis.get(`blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new RpcException({
        statusCode: 401,
        code: "REFRESH_REVOKED",
        message: "Refresh token révoqué",
      });
    }

    // Expiration pour inactivité vérifiée côté serveur : l'âge du refresh token mesure le temps depuis la dernière activité.
    const { session_idle_timeout_minutes, session_max_duration_hours, session_refresh_grace_seconds } =
      await this.platformConfig.get();
    const now = Math.floor(Date.now() / 1000);
    // Heure de la connexion d'origine, recopiée à chaque rotation (jetons
    // émis avant ce champ : repli sur leur propre date d'émission).
    const authTime = payload.auth_time ?? payload.iat;

    // Durée maximale absolue de session, même en usage continu.
    if (now - authTime > session_max_duration_hours * 3600) {
      await this.revokeRefreshJti(payload.jti, payload.exp);
      throw new RpcException({
        statusCode: 401,
        code: "SESSION_MAX_DURATION",
        message: "Durée maximale de session atteinte — reconnectez-vous.",
      });
    }

    if (now - payload.iat > session_idle_timeout_minutes * 60) {
      await this.revokeRefreshJti(payload.jti, payload.exp);
      throw new RpcException({
        statusCode: 401,
        code: "SESSION_IDLE",
        message: "Session expirée après une période d'inactivité — reconnectez-vous.",
      });
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 401,
        code: "ACCOUNT_UNAVAILABLE",
        message: "Utilisateur introuvable ou suspendu",
      });
    }

    // Rotation : l'ancien refresh token est blacklisté, un jeton volé ne sert qu'une fois.
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${payload.jti}`, "1", "EX", ttl);
    }

    const tokens = this.generateTokens(user, authTime);
    if (session_refresh_grace_seconds > 0) {
      await this.redis.set(`rotated:${payload.jti}`, JSON.stringify(tokens), "EX", session_refresh_grace_seconds);
    }
    return tokens;
  }

  private async revokeRefreshJti(jti: string, exp: number): Promise<void> {
    const remaining = exp - Math.floor(Date.now() / 1000);
    if (remaining > 0) {
      await this.redis.set(`blacklist:${jti}`, "1", "EX", remaining);
    }
  }

  async logout(dto: RefreshTokenDto) {
    let payload: { jti?: string; exp?: number };
    try {
      payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      // Jeton invalide ou expiré : rien à révoquer, on ne se fie jamais à un payload non vérifié.
      return { success: true };
    }

    if (payload.jti && payload.exp) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.set(`blacklist:${payload.jti}`, "1", "EX", ttl);
      }
      // Jeton déjà renouvelé : sa paire gardée pour le délai de grâce ne doit plus être servie.
      await this.redis.del(`rotated:${payload.jti}`);
    }
    return { success: true };
  }

  async oauthLogin(data: OAuthProfile) {
    if (!data.email) {
      // Email obligatoire : sans lui, collision sur chaîne vide et billets impossibles à envoyer.
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
        // Google et Facebook ne donnent pas la date de naissance : le compte n'est créé qu'après sa saisie et vérification.
        return this.requireOAuthBirthDate({ profile: data }, data.first_name);
      }
    }

    if (!user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 403,
        message: "Compte suspendu ou désactivé",
      });
    }

    // Compte créé avant la règle d'âge : même étape avant tout accès.
    if (!user.birth_date) {
      return this.requireOAuthBirthDate({ user_id: user.id }, user.first_name);
    }

    return this.finishOAuthLogin(user);
  }

  private async requireOAuthBirthDate(pending: OAuthBirthDatePending, firstName: string) {
    const pendingToken = randomBytes(32).toString("hex");
    await this.redis.set(
      `oauth_birth_date_pending:${pendingToken}`,
      JSON.stringify(pending),
      "EX",
      OAUTH_BIRTH_DATE_PENDING_TTL,
    );
    return {
      requires_birth_date: true as const,
      pending_token: pendingToken,
      first_name: firstName,
    };
  }

  /** Suite d'une connexion Google/Facebook sans date de naissance : contrôle d'âge, création du compte, puis connexion normale. */
  async completeOAuthBirthDate(pendingToken: string, birthDate: string) {
    const key = `oauth_birth_date_pending:${pendingToken}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new RpcException({
        statusCode: 400,
        message: "Session de connexion expirée — reconnectez-vous.",
      });
    }

    await this.assertAllowedBirthDate(birthDate);
    await this.redis.del(key); // usage unique, une fois l'âge validé

    const pending = JSON.parse(raw) as OAuthBirthDatePending;
    let user: User | null;

    if ("user_id" in pending) {
      user = await this.userRepo.findOne({ where: { id: pending.user_id } });
      if (!user) {
        throw new RpcException({ statusCode: 404, message: "Utilisateur introuvable" });
      }
      user.birth_date = birthDate;
      await this.userRepo.save(user);
    } else {
      const { profile } = pending;
      // Le même email a pu être inscrit entre-temps (jusqu'à 15 min) : on
      // relie alors le compte existant plutôt que d'en créer un doublon.
      user = await this.userRepo.findOne({ where: { email: profile.email } });
      if (user) {
        user.oauth_provider = profile.provider;
        user.oauth_id = profile.oauth_id;
        user.birth_date ??= birthDate;
      } else {
        user = this.userRepo.create({
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          birth_date: birthDate,
          oauth_provider: profile.provider,
          oauth_id: profile.oauth_id,
          is_email_verified: true,
          email_verified_at: new Date(),
          role: UserRole.BUYER,
        });
      }
      await this.userRepo.save(user);
    }

    if (!user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 403,
        message: "Compte suspendu ou désactivé",
      });
    }

    return this.finishOAuthLogin(user);
  }

  private async finishOAuthLogin(user: User) {

    // 2FA exigée aussi en OAuth : renvoie une référence opaque à usage unique, échangée avec le code (verifyOauth2fa).
    if (user.two_factor_enabled) {
      const pendingToken = randomBytes(32).toString("hex");
      await this.redis.set(
        `oauth_2fa_pending:${pendingToken}`,
        user.id,
        "EX",
        OAUTH_2FA_PENDING_TTL,
      );
      return {
        requires_2fa: true,
        two_factor_method: user.two_factor_method,
        pending_token: pendingToken,
      };
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /** Second temps du login OAuth quand la 2FA est activée — voir oauthLogin(). */
  async verifyOauth2fa(pendingToken: string, code: string) {
    const key = `oauth_2fa_pending:${pendingToken}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new RpcException({
        statusCode: 400,
        message: "Session de connexion expirée — reconnectez-vous.",
      });
    }
    await this.redis.del(key); // usage unique

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new RpcException({ statusCode: 404, message: "Utilisateur introuvable" });
    }
    // Revérifié : le compte a pu être suspendu depuis oauthLogin().
    if (!user.is_active || user.is_suspended) {
      throw new RpcException({
        statusCode: 403,
        message: "Compte suspendu ou désactivé",
      });
    }

    const validCode = await this.twoFactorService.verify(user.id, code);
    if (!validCode) {
      await this.registerFailedLoginAttempt(user);
      throw new RpcException({ statusCode: 401, message: "Code 2FA invalide" });
    }

    return { ...this.generateTokens(user), user: this.sanitize(user) };
  }

  /** Jamais de jetons en clair dans l'URL de redirection OAuth : code opaque à usage unique, échangé côté serveur. */
  async createOAuthExchangeCode(payload: OAuthExchangePayload): Promise<string> {
    const code = randomBytes(32).toString("hex");
    await this.redis.set(
      `oauth_exchange:${code}`,
      JSON.stringify(payload),
      "EX",
      OAUTH_EXCHANGE_TTL,
    );
    return code;
  }

  async exchangeOAuthCode(code: string): Promise<OAuthExchangePayload> {
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

  /** Renvoi du lien de vérification d'email (lien expiré ou jamais reçu). */
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

  /** Invitation d'un agent par email : compte actif prévenu, sinon lien pour choisir son mot de passe ; autre rôle refusé. */
  async inviteAgent(data: {
    email: string;
    first_name: string;
    last_name: string;
    event_name: string;
    event_date: string;
    organizer_name: string;
  }): Promise<{ user_id: string; created: boolean }> {
    const email = data.email.trim().toLowerCase();
    let user = await this.findWithPasswordState("u.email = :email", { email });
    if (user && user.role !== UserRole.AGENT) {
      throw new RpcException({
        statusCode: 409,
        message:
          "Cette adresse appartient déjà à un compte acheteur ou organisateur : l'agent de contrôle doit utiliser une adresse dédiée.",
      });
    }

    const created = !user;
    if (!user) {
      const firstName = data.first_name.trim();
      const lastName = data.last_name.trim();
      if (!firstName || !lastName) {
        throw new RpcException({ statusCode: 400, message: "Le prénom et le nom de l'agent sont obligatoires." });
      }
      user = await this.userRepo.save(
        this.userRepo.create({
          email,
          password_hash: null,
          first_name: firstName,
          last_name: lastName,
          role: UserRole.AGENT,
          is_email_verified: false,
        }),
      );
    }

    const link = user.password_hash ? null : await this.issueAgentPasswordLink(user.id);
    this.emitAgentInvitation(user, data, link);
    return { user_id: user.id, created };
  }

  /** Nouveau lien pour un agent qui n'a pas encore choisi son mot de passe ; refusé si le compte est déjà activé. */
  async resendAgentInvitation(data: {
    user_id: string;
    event_name: string;
    event_date: string;
    organizer_name: string;
  }): Promise<{ success: true }> {
    const user = await this.findWithPasswordState("u.id = :id", { id: data.user_id });
    if (!user || user.role !== UserRole.AGENT) {
      throw new RpcException({ statusCode: 404, message: "Agent introuvable." });
    }
    if (user.password_hash) {
      throw new RpcException({
        statusCode: 409,
        message: "Cet agent a déjà activé son compte : il se connecte avec son mot de passe.",
      });
    }
    this.emitAgentInvitation(user, data, await this.issueAgentPasswordLink(user.id));
    return { success: true };
  }

  /** Compte avec son mot de passe haché (exclu par défaut) : indique si l'agent a activé son compte. */
  private findWithPasswordState(where: string, params: Record<string, string>): Promise<User | null> {
    return this.userRepo.createQueryBuilder("u").addSelect("u.password_hash").where(where, params).getOne();
  }

  /** Lien « choisir mon mot de passe », valable agent_invitation_hours. */
  private async issueAgentPasswordLink(userId: string): Promise<{ token: string; validHours: number }> {
    const validHours = (await this.platformConfig.get()).agent_invitation_hours;
    const token = randomUUID();
    await this.redis.set(`reset_password:${token}`, userId, "EX", validHours * 3600);
    return { token, validHours };
  }

  private emitAgentInvitation(
    user: User,
    data: { event_name: string; event_date: string; organizer_name: string },
    link: { token: string; validHours: number } | null,
  ): void {
    this.notifClient.emit("notification.agent_invitation", {
      email: user.email,
      firstName: user.first_name,
      eventName: data.event_name,
      eventDate: data.event_date,
      organizerName: data.organizer_name,
      ...(link ? { token: link.token, validHours: link.validHours } : {}),
    });
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

    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id: userId })
      .getOne();
    if (!user) {
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    }

    await this.assertPasswordPolicy(dto.new_password, user);
    await this.assertNewPasswordDiffers(dto.new_password, user.password_hash);

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    user.password_changed_at = new Date();
    // Lien reçu par email et suivi : l'adresse est confirmée (cas d'un agent
    // invité, dont le compte est créé sans vérification préalable).
    if (!user.is_email_verified) {
      user.is_email_verified = true;
      user.email_verified_at = new Date();
    }
    await this.userRepo.save(user);
    await this.redis.del(`reset_password:${dto.token}`);

    // CDC §10.3 : journalisation sans attente, un échec ne fait jamais échouer la réinitialisation.
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

  /** Changement du mot de passe depuis le profil, l'ancien mot de passe étant requis. */
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

    await this.assertPasswordPolicy(dto.new_password, user);
    await this.assertNewPasswordDiffers(dto.new_password, user.password_hash);

    user.password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    user.password_changed_at = new Date();
    await this.userRepo.save(user);

    // CDC §10.3 : journalisation sans attente, un échec ne fait jamais échouer le changement.
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
    // Identifiant mal formé : introuvable, plutôt qu'une erreur SQL en 500.
    const user = isUUID(id) ? await this.userRepo.findOne({ where: { id } }) : null;
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    return this.sanitize(user);
  }

  /** Compte associé à un email (casse ignorée), ou null ; réservé aux appels internes. */
  async findByEmail(email: string) {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email: email.trim() })
      .getOne();
    return user ? this.sanitize(user) : null;
  }

  /** Résolution par lot (ex. newsletter) — évite un aller-retour par utilisateur. */
  async getUsersByIds(ids: string[]) {
    // Un seul identifiant mal formé ne doit pas faire échouer toute la
    // requête : les identifiants invalides sont ignorés (comptes introuvables).
    const validIds = ids.filter((id) => isUUID(id));
    if (validIds.length === 0) return [];
    const users = await this.userRepo.findBy({ id: In(validIds) });
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

  async suspendUser(
    id: string,
    adminId: string,
    reason: string,
    actorRole: UserRole,
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    assertCanManageTarget(user, adminId, actorRole);

    user.is_suspended = true;
    user.suspension_reason = reason;
    user.suspended_at = new Date();
    user.suspended_by = adminId;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  async unsuspendUser(id: string, actorId: string, actorRole: UserRole) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    assertCanManageTarget(user, actorId, actorRole);

    user.is_suspended = false;
    user.suspension_reason = null;
    user.suspended_at = null;
    user.suspended_by = null;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /** Handler de auth.unlock_account, appelé par POST /admin/users/:id/unlock. */
  async unlockAccount(id: string, actorId: string, actorRole: UserRole) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    assertCanManageTarget(user, actorId, actorRole);

    user.failed_login_attempts = 0;
    user.locked_until = null;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /** Handler de auth.activate_account, appelé par POST /admin/users/:id/activate. */
  async activateAccount(id: string, actorId: string, actorRole: UserRole) {
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
    assertCanManageTarget(user, actorId, actorRole);

    user.is_email_verified = true;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  async changeRole(
    id: string,
    role: UserRole,
    actorId: string,
    actorRole: UserRole,
  ) {
    if (!Object.values(UserRole).includes(role)) {
      throw new RpcException({ statusCode: 400, message: "Rôle invalide" });
    }
    // Accorder ADMIN/SUPER_ADMIN est tout aussi sensible qu'agir sur un
    // admin existant (cf. assertCanManageTarget) — même garde-fou.
    const grantsElevatedRole =
      role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
    if (grantsElevatedRole && actorRole !== UserRole.SUPER_ADMIN) {
      throw new RpcException({
        statusCode: 403,
        message: "Seul un super-admin peut accorder ce rôle",
      });
    }

    const user = await this.userRepo.findOne({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    assertCanManageTarget(user, actorId, actorRole);

    user.role = role;
    await this.userRepo.save(user);

    return this.sanitize(user);
  }

  /** Bascule self-service BUYER → ORGANIZER, avec de nouveaux jetons (contrairement à changeRole() par un admin). */
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
    status?: UserListStatus;
    sort?: UserListSort;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ReturnType<AuthService["sanitize"]>[]; total: number }> {
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = filters.offset ?? 0;

    const qb = this.userRepo
      .createQueryBuilder("u")
      // createQueryBuilder ne filtre pas deleted_at : exclusion explicite des comptes supprimés (RGPD).
      .where("u.deleted_at IS NULL")
      .skip(offset)
      .take(limit);

    if (filters.sort === "oldest") qb.orderBy("u.created_at", "ASC");
    else if (filters.sort === "name") qb.orderBy("LOWER(u.last_name)", "ASC").addOrderBy("LOWER(u.first_name)", "ASC");
    else qb.orderBy("u.created_at", "DESC");

    if (filters.q?.trim()) {
      // Nom complet dans les deux sens : « Adama Diawara » comme « Diawara Adama ».
      qb.andWhere(
        `(LOWER(u.email) LIKE :q
          OR LOWER(u.first_name || ' ' || u.last_name) LIKE :q
          OR LOWER(u.last_name || ' ' || u.first_name) LIKE :q)`,
        { q: `%${filters.q.trim().toLowerCase()}%` },
      );
    }
    if (filters.status === "active") {
      qb.andWhere("u.is_suspended = false").andWhere("(u.locked_until IS NULL OR u.locked_until <= NOW())");
    } else if (filters.status === "suspended") {
      qb.andWhere("u.is_suspended = true");
    } else if (filters.status === "locked") {
      qb.andWhere("u.locked_until > NOW()");
    } else if (filters.status === "unverified") {
      qb.andWhere("u.is_email_verified = false");
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

  /** Effacement RGPD : anonymise le compte et pose un soft-delete ; les obligations en cours sont vérifiées par la gateway. */
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

  /** @param authTime heure de la connexion d'origine, conservée lors d'un refresh (durée maximale de session). */
  private generateTokens(
    user: User,
    authTime: number = Math.floor(Date.now() / 1000),
  ): {
    access_token: string;
    refresh_token: string;
  } {
    const jti = randomUUID();

    const access_token = this.signAccess(user, authTime);

    const refresh_token = this.jwtService.sign(
      { sub: user.id, jti, auth_time: authTime },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "30d",
      },
    );

    return { access_token, refresh_token };
  }

  /** auth_time dans le jeton d'accès : la gateway exige une connexion récente pour les actions sensibles. */
  private signAccess(user: User, authTime: number): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, auth_time: authTime },
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
