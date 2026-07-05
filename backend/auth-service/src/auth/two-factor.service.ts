import { Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { TwoFactorMethod, User } from "../user/user.entity";

@Injectable()
export class TwoFactorService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
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

    // Codes de secours (8 codes à usage unique)
    const backup_codes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    return { success: true, backup_codes };
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

  async disable(userId: string, code: string): Promise<{ success: boolean }> {
    const valid = await this.verifyTotp(userId, code);
    if (!valid) {
      throw new RpcException({
        statusCode: 400,
        message: "Code TOTP invalide",
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
