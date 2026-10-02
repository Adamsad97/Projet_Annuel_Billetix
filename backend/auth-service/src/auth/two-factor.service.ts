import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Redis } from "ioredis";
import { IsNull, Repository } from "typeorm";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TwoFactorMethod, User, UserRole } from "../user/user.entity";
import { assertCanManageTarget } from "./assert-can-manage-target";
import { BackupCode } from "./backup-code.entity";

const BACKUP_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 12;
// Fenêtre de tolérance otplib (step 30s ± 1) — un code reste valide ~90s,
// donc la marque anti-rejeu doit couvrir toute cette fenêtre.
const TOTP_REPLAY_WINDOW_SECONDS = 90;

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(BackupCode) private readonly backupCodeRepo: Repository<BackupCode>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
  ) {}

  /** CDC §10.3 : journalisation sans attente, un échec ne fait jamais échouer l'action. */
  private logSelfAction(action: string, userId: string): void {
    this.adminClient
      .send("admin.log_action", {
        action,
        entity_type: "USER",
        entity_id: userId,
        performed_by: userId,
        reason: "Action effectuée par le titulaire du compte lui-même",
      })
      .subscribe({ error: () => undefined });
  }

  async setupTotp(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.getUser(userId);
    if (user.two_factor_enabled) {
      throw new RpcException({ statusCode: 409, message: "2FA déjà activée" });
    }

    const secret = authenticator.generateSecret();
    const appName = "BilleTix";
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Stocker le secret temporairement — sera validé lors de la confirmation
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ two_factor_secret: secret })
      .where("id = :id", { id: userId })
      .execute();

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirmTotp(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; backup_codes: string[] }> {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.two_factor_secret")
      .where("u.id = :id", { id: userId })
      .getOne();

    if (!user?.two_factor_secret) {
      throw new RpcException({
        statusCode: 400,
        message: "Aucune configuration 2FA en attente",
      });
    }

    const valid = authenticator.verify({
      token: code,
      secret: user.two_factor_secret,
    });
    if (!valid) {
      throw new RpcException({
        statusCode: 400,
        message: "Code TOTP invalide",
      });
    }

    await this.userRepo.update(userId, {
      two_factor_enabled: true,
      two_factor_method: TwoFactorMethod.TOTP,
    });
    this.logSelfAction("USER_2FA_ENABLED", userId);

    return { success: true, backup_codes: await this.generateAndPersistBackupCodes(userId) };
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const user = await this.userRepo
      .createQueryBuilder("u")
      .addSelect("u.two_factor_secret")
      .where("u.id = :id", { id: userId })
      .getOne();

    if (!user?.two_factor_enabled || !user.two_factor_secret) {
      throw new RpcException({ statusCode: 400, message: "2FA non activée" });
    }

    const valid = authenticator.verify({
      token: code,
      secret: user.two_factor_secret,
    });
    if (!valid) return false;

    // Anti-rejeu : un code TOTP n'est utilisable qu'une fois pendant sa fenêtre de validité.
    const replayKey = `2fa_totp_used:${userId}:${code}`;
    const alreadyUsed = await this.redis.get(replayKey);
    if (alreadyUsed) return false;

    await this.redis.set(replayKey, "1", "EX", TOTP_REPLAY_WINDOW_SECONDS);
    return true;
  }

  /** Vérifie un code TOTP, avec repli sur un code de secours. */
  async verify(userId: string, code: string): Promise<boolean> {
    const primaryValid = await this.verifyTotp(userId, code);
    if (primaryValid) return true;
    return this.verifyBackupCode(userId, code);
  }

  /** Génère 8 codes de secours, les hache (bcrypt) et les persiste — les codes en clair ne sont jamais stockés, seul cet appel les révèle. */
  private async generateAndPersistBackupCodes(userId: string): Promise<string[]> {
    await this.backupCodeRepo.delete({ user_id: userId });

    const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomInt(0, 36 ** 8).toString(36).padStart(8, "0").toUpperCase(),
    );

    // Hachages en parallèle (pool de threads de Node) : environ 4 fois plus rapide que l'un après l'autre.
    const hashes = await Promise.all(plainCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)));
    for (const code_hash of hashes) {
      await this.backupCodeRepo.save(this.backupCodeRepo.create({ user_id: userId, code_hash }));
    }

    return plainCodes;
  }

  /** Compare le code fourni aux hachages non utilisés ; marque le code comme consommé (usage unique) en cas de correspondance. */
  private async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const candidates = await this.backupCodeRepo.find({
      where: { user_id: userId, used_at: IsNull() },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(code, candidate.code_hash)) {
        await this.backupCodeRepo.update(candidate.id, { used_at: new Date() });
        return true;
      }
    }
    return false;
  }

  async disable(userId: string, code: string): Promise<{ success: boolean }> {
    const valid = await this.verify(userId, code);
    if (!valid) {
      throw new RpcException({
        statusCode: 400,
        message: "Code 2FA invalide",
      });
    }

    // La 2FA reste un choix personnel, y compris pour un organisateur payé par virement.
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        two_factor_enabled: false,
        two_factor_method: null,
        two_factor_secret: null,
      })
      .where("id = :id", { id: userId })
      .execute();

    // Les anciens codes de secours n'ont plus lieu d'être une fois la 2FA désactivée.
    await this.backupCodeRepo.delete({ user_id: userId });
    this.logSelfAction("USER_2FA_DISABLED", userId);

    return { success: true };
  }

  /** Réinitialisation de la 2FA par un admin (appareil et codes de secours perdus), sans code à vérifier. */
  async resetByAdmin(
    userId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<{ success: boolean; email: string; first_name: string }> {
    const user = await this.getUser(userId);
    if (!user.two_factor_enabled) {
      throw new RpcException({
        statusCode: 400,
        message: "La 2FA n'est pas activée sur ce compte",
      });
    }
    // Même règle que les autres actions admin (assertCanManageTarget).
    assertCanManageTarget(user, actorId, actorRole);

    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({
        two_factor_enabled: false,
        two_factor_method: null,
        two_factor_secret: null,
      })
      .where("id = :id", { id: userId })
      .execute();

    await this.backupCodeRepo.delete({ user_id: userId });

    return { success: true, email: user.email, first_name: user.first_name };
  }

  async isTwoFactorRequired(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user.two_factor_enabled;
  }

  private async getUser(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: "Utilisateur introuvable",
      });
    return user;
  }
}
