import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Redis } from "ioredis";
import { firstValueFrom } from "rxjs";
import { IsNull, Repository } from "typeorm";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TwoFactorMethod, User } from "../user/user.entity";
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
    @Inject("USER_SERVICE") private readonly userClient: ClientProxy,
    @Inject("ADMIN_SERVICE") private readonly adminClient: ClientProxy,
  ) {}

  /**
   * CDC §10.3 : audit trail de toutes les actions sensibles, pas seulement
   * celles de l'admin. Fire-and-forget — un échec de journalisation ne doit
   * jamais faire échouer l'action elle-même.
   */
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
    const appName = "BilletiX";
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

    // Anti-rejeu : un code TOTP intercepté (shoulder-surfing, capture
    // réseau) ne doit être utilisable qu'une seule fois pendant sa fenêtre
    // de validité, même s'il reste mathématiquement correct pendant ~90s.
    const replayKey = `2fa_totp_used:${userId}:${code}`;
    const alreadyUsed = await this.redis.get(replayKey);
    if (alreadyUsed) return false;

    await this.redis.set(replayKey, "1", "EX", TOTP_REPLAY_WINDOW_SECONDS);
    return true;
  }

  /**
   * Vérifie un code 2FA TOTP, avec repli sur un code de secours si le code
   * principal ne correspond pas (perte de l'appareil authenticator).
   */
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

    for (const code of plainCodes) {
      const code_hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
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

    // CDC §2.3 : 2FA obligatoire tant qu'un IBAN organisateur est enregistré.
    // Déjà appliqué à l'écriture de l'IBAN (organizer.service.ts updateIban()
    // refuse si la 2FA n'est pas active) mais pas ici — bug corrigé : sans ce
    // contrôle miroir, un organisateur pouvait activer la 2FA, enregistrer
    // son IBAN, puis désactiver la 2FA, laissant l'IBAN sans la protection
    // exigée. user.get_iban lève une 404 (capturée ici) s'il n'y a pas d'IBAN.
    const hasIban = await firstValueFrom(
      this.userClient.send("user.get_iban", { user_id: userId }),
    )
      .then(() => true)
      .catch(() => false);
    if (hasIban) {
      throw new RpcException({
        statusCode: 409,
        message:
          "Impossible de désactiver la 2FA tant qu'un IBAN est enregistré sur votre compte organisateur (CDC §2.3).",
      });
    }

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
