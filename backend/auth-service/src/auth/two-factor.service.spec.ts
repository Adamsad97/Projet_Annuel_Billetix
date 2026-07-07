import { Test } from "@nestjs/testing";
import { RpcException } from "@nestjs/microservices";
import { getRepositoryToken } from "@nestjs/typeorm";
import { REDIS_CLIENT } from "../redis/redis.module";
import { TwoFactorMethod, User } from "../user/user.entity";
import { TwoFactorService } from "./two-factor.service";

describe("TwoFactorService — SMS", () => {
  let service: TwoFactorService;
  let userRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let updateQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
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
    };
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(updateQueryBuilder),
    };
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    notifClient = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: "NOTIFICATION_SERVICE", useValue: notifClient },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  describe("setupSms", () => {
    it("rejette si la 2FA est déjà activée", async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
      });
      await expect(service.setupSms("user-1")).rejects.toThrow(RpcException);
    });

    it("rejette sans numéro de téléphone disponible", async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser, phone: null });
      await expect(service.setupSms("user-1")).rejects.toThrow(RpcException);
    });

    it("envoie un code SMS et masque le numéro retourné", async () => {
      userRepo.findOne.mockResolvedValue(baseUser);
      const result = await service.setupSms("user-1");

      expect(result.success).toBe(true);
      expect(result.phone_masked).toBe("••••••••5678");
      expect(notifClient.emit).toHaveBeenCalledWith(
        "notification.sms_2fa_code",
        expect.objectContaining({ phone: "+33612345678" }),
      );
      expect(redis.set).toHaveBeenCalledWith(
        "2fa_sms_setup:user-1",
        expect.any(String),
        "EX",
        300,
      );
    });
  });

  describe("confirmSms", () => {
    it("rejette un code invalide ou expiré", async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.confirmSms("user-1", "123456")).rejects.toThrow(
        RpcException,
      );
    });

    it("active la 2FA SMS avec un code valide et retourne des codes de secours", async () => {
      redis.get.mockResolvedValue("123456");
      const result = await service.confirmSms("user-1", "123456");

      expect(result.success).toBe(true);
      expect(result.backup_codes).toHaveLength(8);
      expect(redis.del).toHaveBeenCalledWith("2fa_sms_setup:user-1");
      expect(userRepo.update).toHaveBeenCalledWith("user-1", {
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.SMS,
      });
    });
  });

  describe("sendVerificationSms", () => {
    it("rejette sans numéro de téléphone associé", async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser, phone: null });
      await expect(service.sendVerificationSms("user-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("envoie un code de vérification par SMS", async () => {
      userRepo.findOne.mockResolvedValue(baseUser);
      await service.sendVerificationSms("user-1");

      expect(notifClient.emit).toHaveBeenCalledWith(
        "notification.sms_2fa_code",
        expect.objectContaining({ phone: "+33612345678" }),
      );
      expect(redis.set).toHaveBeenCalledWith(
        "2fa_verify_sms:user-1",
        expect.any(String),
        "EX",
        300,
      );
    });
  });

  describe("verify", () => {
    it("vérifie via le code SMS quand la méthode active est SMS", async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.SMS,
      });
      redis.get.mockResolvedValue("654321");

      const valid = await service.verify("user-1", "654321");

      expect(valid).toBe(true);
      expect(redis.del).toHaveBeenCalledWith("2fa_verify_sms:user-1");
    });

    it("rejette un code SMS incorrect sans le supprimer de redis", async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        two_factor_enabled: true,
        two_factor_method: TwoFactorMethod.SMS,
      });
      redis.get.mockResolvedValue("654321");

      const valid = await service.verify("user-1", "000000");

      expect(valid).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
