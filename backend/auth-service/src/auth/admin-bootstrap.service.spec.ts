import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "../user/user.entity";
import { AdminBootstrapService } from "./admin-bootstrap.service";

jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));

describe("AdminBootstrapService", () => {
  let service: AdminBootstrapService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn(), create: jest.fn((data) => data), save: jest.fn() };
    config = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminBootstrapService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AdminBootstrapService);
  });

  it("ne fait rien si les variables d'environnement ne sont pas définies", async () => {
    config.get.mockReturnValue(undefined);
    await service.onModuleInit();
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("ne recrée jamais un admin si un compte ADMIN existe déjà", async () => {
    config.get.mockImplementation((key: string) =>
      key === "BOOTSTRAP_ADMIN_EMAIL" ? "admin@billetix.local" : "SuperSecret123!",
    );
    userRepo.findOne.mockResolvedValue({ id: "existing-admin" });

    await service.onModuleInit();

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { role: UserRole.ADMIN } });
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("crée le premier admin quand aucun n'existe et que les variables sont définies", async () => {
    config.get.mockImplementation((key: string) =>
      key === "BOOTSTRAP_ADMIN_EMAIL" ? "admin@billetix.local" : "SuperSecret123!",
    );
    userRepo.findOne.mockResolvedValue(null);

    await service.onModuleInit();

    expect(bcrypt.hash).toHaveBeenCalledWith("SuperSecret123!", 12);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@billetix.local",
        password_hash: "hashed",
        role: UserRole.ADMIN,
        is_email_verified: true,
      }),
    );
  });
});
