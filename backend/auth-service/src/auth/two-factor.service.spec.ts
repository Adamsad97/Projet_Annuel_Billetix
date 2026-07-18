import { Test } from "@nestjs/testing";
import { RpcException } from "@nestjs/microservices";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TwoFactorMethod, User } from "../user/user.entity";
import { BackupCode } from "./backup-code.entity";
import { TwoFactorService } from "./two-factor.service";

jest.mock("otplib", () => ({
  authenticator: { verify: jest.fn(), generateSecret: jest.fn(), keyuri: jest.fn() },
}));

describe("TwoFactorService — TOTP", () => {
  let service: TwoFactorService;
  let userRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let backupCodeRepo: {
    find: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let updateQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
    addSelect: jest.Mock;
    getOne: jest.Mock;
  };

  const baseUser: Partial<User> = {
    id: "user-1",
    email: "jean@example.com",
    phone: "+33612345678",
    two_factor_enabled: false,
    two_factor_method: null,
  };

  beforeEach(async () => {
    updateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      addSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    (authenticator.verify as jest.Mock).mockReset();
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(updateQueryBuilder),
    };
    backupCodeRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      create: jest.fn().mockImplementation((code) => code),
      save: jest.fn().mockImplementation((code) => Promise.resolve(code)),
      update: jest.fn(),
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(BackupCode), useValue: backupCodeRepo },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  describe("confirmTotp", () => {
    it("rejette si aucune configuration 2FA n'est en attente", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_secret: null });

      await expect(service.confirmTotp("user-1", "123456")).rejects.toThrow(RpcException);
    });

    it("rejette un code TOTP invalide", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_secret: "SECRET" });
      (authenticator.verify as jest.Mock).mockReturnValue(false);

      await expect(service.confirmTotp("user-1", "000000")).rejects.toThrow(RpcException);
    });

    it("active la 2FA TOTP avec un code valide et retourne des codes de secours", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_secret: "SECRET" });
      (authenticator.verify as jest.Mock).mockReturnValue(true);

      const result = await service.confirmTotp("user-1", "123456");

      expect(result.success).toBe(true);
      expect(result.backup_codes).toHaveLength(8);
      expect(userRepo.update).toHaveBeenCalledWith("user-1", {
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.TOTP,
      });
    });
  });

  describe("verify", () => {
    it("vérifie via un code TOTP valide", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      redis.get.mockResolvedValue(null);

      const valid = await service.verify("user-1", "123456");

      expect(valid).toBe(true);
    });

    it("accepte un code de secours valide en repli quand le code TOTP ne correspond pas", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      const hash = await bcrypt.hash("BACKUP01", 4);
      backupCodeRepo.find.mockResolvedValue([{ id: "code-1", code_hash: hash }]);

      const valid = await service.verify("user-1", "BACKUP01");

      expect(valid).toBe(true);
      expect(backupCodeRepo.update).toHaveBeenCalledWith("code-1", { used_at: expect.any(Date) });
    });

    it("ne réutilise jamais un code de secours déjà consommé (find ne renvoie que les non-utilisés)", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      backupCodeRepo.find.mockResolvedValue([]); // déjà utilisé, donc plus dans la liste

      const valid = await service.verify("user-1", "BACKUP01");

      expect(valid).toBe(false);
    });
  });

  describe("verifyTotp — protection anti-rejeu", () => {
    it("rejette si la 2FA TOTP n'est pas activée", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_enabled: false });

      await expect(service.verifyTotp("user-1", "123456")).rejects.toThrow(RpcException);
    });

    it("accepte un code TOTP valide la première fois", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      redis.get.mockResolvedValue(null);

      const valid = await service.verifyTotp("user-1", "123456");

      expect(valid).toBe(true);
      expect(redis.set).toHaveBeenCalledWith("2fa_totp_used:user-1:123456", "1", "EX", 90);
    });

    it("rejette le même code TOTP réutilisé (rejeu) même s'il reste mathématiquement valide", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      redis.get.mockResolvedValue("1"); // déjà marqué comme utilisé

      const valid = await service.verifyTotp("user-1", "123456");

      expect(valid).toBe(false);
    });

    it("rejette un code TOTP mathématiquement invalide sans même consulter le marqueur anti-rejeu", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(false);

      const valid = await service.verifyTotp("user-1", "000000");

      expect(valid).toBe(false);
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe("codes de secours — persistance réelle", () => {
    it("génère 8 codes hachés (bcrypt) et persistés, jamais stockés en clair", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_secret: "SECRET" });
      (authenticator.verify as jest.Mock).mockReturnValue(true);

      const result = await service.confirmTotp("user-1", "123456");

      expect(result.backup_codes).toHaveLength(8);
      expect(backupCodeRepo.save).toHaveBeenCalledTimes(8);
      const savedHash = backupCodeRepo.save.mock.calls[0][0].code_hash;
      expect(savedHash).not.toBe(result.backup_codes[0]);
      expect(await bcrypt.compare(result.backup_codes[0], savedHash)).toBe(true);
    });

    it("supprime les anciens codes de secours avant d'en générer de nouveaux", async () => {
      updateQueryBuilder.getOne.mockResolvedValue({ ...baseUser, two_factor_secret: "SECRET" });
      (authenticator.verify as jest.Mock).mockReturnValue(true);

      await service.confirmTotp("user-1", "123456");

      expect(backupCodeRepo.delete).toHaveBeenCalledWith({ user_id: "user-1" });
    });

    it("supprime les codes de secours quand la 2FA est désactivée", async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      updateQueryBuilder.getOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_secret: "SECRET",
      });
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      redis.get.mockResolvedValue(null);

      await service.disable("user-1", "123456");

      expect(backupCodeRepo.delete).toHaveBeenCalledWith({ user_id: "user-1" });
    });
  });
});
