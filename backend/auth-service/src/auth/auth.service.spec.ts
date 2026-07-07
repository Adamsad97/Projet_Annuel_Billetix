import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RpcException } from "@nestjs/microservices";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { REDIS_CLIENT } from "../redis/redis.module";
import {
  OAuthProvider,
  TwoFactorMethod,
  User,
  UserRole,
} from "../user/user.entity";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";

describe("AuthService", () => {
  let service: AuthService;
  let queryBuilder: {
    addSelect: jest.Mock;
    where: jest.Mock;
    getOne: jest.Mock;
  };
  let twoFactorService: {
    verifyTotp: jest.Mock;
    verify: jest.Mock;
    sendVerificationSms: jest.Mock;
  };

  const baseUser: Partial<User> = {
    id: "user-1",
    email: "jean@example.com",
    password_hash: null,
    is_active: true,
    is_suspended: false,
    two_factor_enabled: false,
    role: UserRole.BUYER,
  };

  beforeEach(async () => {
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    twoFactorService = {
      verifyTotp: jest.fn(),
      verify: jest.fn(),
      sendVerificationSms: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            findOne: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue("signed-token") },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        { provide: "NOTIFICATION_SERVICE", useValue: { emit: jest.fn() } },
        { provide: TwoFactorService, useValue: twoFactorService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe("login", () => {
    it("rejette un email inconnu", async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.login({ email: "x@x.com", password: "pw" }),
      ).rejects.toThrow(RpcException);
    });

    it("rejette un compte suspendu", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        is_suspended: true,
      });
      await expect(
        service.login({ email: baseUser.email!, password: "pw" }),
      ).rejects.toThrow(RpcException);
    });

    it("rejette un mot de passe invalide", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
      });
      await expect(
        service.login({
          email: baseUser.email!,
          password: "mauvais-mot-de-passe",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("retourne les tokens quand la 2FA est désactivée", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: false,
      });

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
      });

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(twoFactorService.verify).not.toHaveBeenCalled();
    });

    it("demande le code 2FA sans délivrer de tokens quand la 2FA TOTP est activée et aucun code fourni", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
      });

      expect(result).toEqual({
        requires_2fa: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      expect(twoFactorService.verify).not.toHaveBeenCalled();
      expect(twoFactorService.sendVerificationSms).not.toHaveBeenCalled();
    });

    it("envoie un code SMS et ne délivre pas de tokens quand la 2FA SMS est activée et aucun code fourni", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.SMS,
      });

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
      });

      expect(result).toEqual({
        requires_2fa: true,
        two_factor_method: TwoFactorMethod.SMS,
      });
      expect(twoFactorService.sendVerificationSms).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("rejette un code 2FA invalide", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      twoFactorService.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: baseUser.email!,
          password: "pw",
          two_factor_code: "000000",
        }),
      ).rejects.toThrow(RpcException);
    });

    it("délivre les tokens avec un code 2FA valide", async () => {
      const hash = await bcrypt.hash("pw", 4);
      queryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        password_hash: hash,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
      twoFactorService.verify.mockResolvedValue(true);

      const result = await service.login({
        email: baseUser.email!,
        password: "pw",
        two_factor_code: "123456",
      });

      expect(result).toHaveProperty("access_token");
      expect(twoFactorService.verify).toHaveBeenCalledWith(
        "user-1",
        "123456",
      );
    });
  });

  describe("oauthLogin", () => {
    it("rejette une connexion OAuth sans email (évite une collision sur chaîne vide et la violation de contrainte unique)", async () => {
      await expect(
        service.oauthLogin({
          provider: OAuthProvider.FACEBOOK,
          oauth_id: "fb-123",
          email: "",
          first_name: "Jean",
          last_name: "Dupont",
        }),
      ).rejects.toThrow(RpcException);
    });
  });
});
