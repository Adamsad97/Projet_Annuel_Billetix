import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Redis } from "ioredis";
import { Repository } from "typeorm";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TwoFactorMethod, User } from "../user/user.entity";

const SMS_CODE_TTL_SECONDS = 5 * 60;

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject("NOTIFICATION_SERVICE") private readonly notifClient: ClientProxy,
  ) {}

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

    return { success: true, backup_codes: this.generateBackupCodes() };
  }

  async setupSms(
    userId: string,
    phone?: string,
  ): Promise<{ success: boolean; phone_masked: string }> {
    const user = await this.getUser(userId);
    if (user.two_factor_enabled) {
      throw new RpcException({ statusCode: 409, message: "2FA déjà activée" });
    }

    const targetPhone = phone || user.phone;
    if (!targetPhone) {
      throw new RpcException({
        statusCode: 400,
        message: "Numéro de téléphone requis pour activer la 2FA par SMS",
      });
    }

    if (phone && phone !== user.phone) {
      await this.userRepo.update(userId, { phone });
    }

    const code = this.generateSmsCode();
    await this.redis.set(
      `2fa_sms_setup:${userId}`,
      code,
      "EX",
      SMS_CODE_TTL_SECONDS,
    );

    this.notifClient.emit("notification.sms_2fa_code", {
      phone: targetPhone,
      code,
    });

    return { success: true, phone_masked: this.maskPhone(targetPhone) };
  }

  async confirmSms(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; backup_codes: string[] }> {
    const key = `2fa_sms_setup:${userId}`;
    const expected = await this.redis.get(key);
    if (!expected || expected !== code) {
      throw new RpcException({
        statusCode: 400,
        message: "Code SMS invalide ou expiré",
      });
    }
    await this.redis.del(key);

    await this.userRepo.update(userId, {
      two_factor_enabled: true,
      two_factor_method: TwoFactorMethod.SMS,
    });

    return { success: true, backup_codes: this.generateBackupCodes() };
  }

  async sendVerificationSms(userId: string): Promise<{ success: boolean }> {
    const user = await this.getUser(userId);
    if (!user.phone) {
      throw new RpcException({
        statusCode: 400,
        message: "Aucun numéro de téléphone associé au compte",
      });
    }

    const code = this.generateSmsCode();
    await this.redis.set(
      `2fa_verify_sms:${userId}`,
      code,
      "EX",
      SMS_CODE_TTL_SECONDS,
    );

    this.notifClient.emit("notification.sms_2fa_code", {
      phone: user.phone,
      code,
    });

    return { success: true };
  }

  private async verifySmsCode(userId: string, code: string): Promise<boolean> {
    const key = `2fa_verify_sms:${userId}`;
    const expected = await this.redis.get(key);
    if (!expected || expected !== code) return false;
    await this.redis.del(key);
    return true;
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

    return authenticator.verify({
      token: code,
      secret: user.two_factor_secret,
    });
  }

  /** Vérifie un code 2FA quelle que soit la méthode active (TOTP générable hors-ligne, SMS envoyé à la demande). */
  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (user.two_factor_method === TwoFactorMethod.SMS) {
      return this.verifySmsCode(userId, code);
    }
    return this.verifyTotp(userId, code);
  }

  async disable(userId: string, code: string): Promise<{ success: boolean }> {
    const valid = await this.verify(userId, code);
    if (!valid) {
      throw new RpcException({
        statusCode: 400,
        message: "Code 2FA invalide",
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

    return { success: true };
  }

  async isTwoFactorRequired(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user.two_factor_enabled;
  }

  private generateSmsCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );
  }

  private maskPhone(phone: string): string {
    return phone.length <= 4
      ? phone
      : `${"•".repeat(phone.length - 4)}${phone.slice(-4)}`;
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
