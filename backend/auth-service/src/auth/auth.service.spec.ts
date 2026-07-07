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
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getOne: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
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
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    twoFactorService = {
      verifyTotp: jest.fn(),
      verify: jest.fn(),
      sendVerificationSms: jest.fn(),
    };
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: repo,
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

  describe("listUsers", () => {
    it("exclut toujours les comptes déjà supprimés (RGPD) des résultats de recherche", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[baseUser], 1]);

      await service.listUsers({});

      expect(queryBuilder.where).toHaveBeenCalledWith("u.deleted_at IS NULL");
    });

    it("plafonne la limite à 100 même si une valeur plus grande est demandée", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ limit: 500 });

      expect(queryBuilder.take).toHaveBeenCalledWith(100);
    });

    it("retourne les résultats sans exposer password_hash (sanitize)", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [{ ...baseUser, password_hash: "secret-hash" }],
        1,
      ]);

      const result = await service.listUsers({ q: "jean" });

      expect(result.total).toBe(1);
      expect(result.data[0]).not.toHaveProperty("password_hash");
    });
  });

  describe("deleteAccount — droit à l'effacement RGPD", () => {
    it("rejette sans mot de passe quand le compte en a un", async () => {
      queryBuilder.getOne.mockResolvedValue({
        id: "user-1",
        password_hash: "some-hash",
      });

      await expect(service.deleteAccount("user-1")).rejects.toThrow(
        RpcException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejette avec un mot de passe incorrect", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({ id: "user-1", password_hash: hash });

      await expect(
        service.deleteAccount("user-1", "mauvais-mot-de-passe"),
      ).rejects.toThrow(RpcException);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });

    it("anonymise le compte et pose le soft-delete avec le bon mot de passe", async () => {
      const hash = await bcrypt.hash("bon-mot-de-passe", 4);
      queryBuilder.getOne.mockResolvedValue({ id: "user-1", password_hash: hash });

      const result = await service.deleteAccount("user-1", "bon-mot-de-passe");

      expect(result).toEqual({ success: true });
      expect(repo.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          email: "deleted-user-1@billetix.invalid",
          phone: null,
          password_hash: null,
          two_factor_enabled: false,
          is_active: false,
        }),
      );
      expect(repo.softDelete).toHaveBeenCalledWith("user-1");
    });

    it("ne demande aucun mot de passe pour un compte OAuth (sans password_hash)", async () => {
      queryBuilder.getOne.mockResolvedValue({ id: "user-2", password_hash: null });

      const result = await service.deleteAccount("user-2");

      expect(result).toEqual({ success: true });
      expect(repo.softDelete).toHaveBeenCalledWith("user-2");
    });
  });
});
