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
    // Bug corrigé : bcrypt.hash est un mock au niveau du module (jest.mock
    // ci-dessus), donc son historique d'appels survit d'un test à l'autre
    // sans ce clear — "promeut en SUPER_ADMIN..." échouait dès que le test
    // "crée le premier super-admin..." (qui appelle bcrypt.hash) tournait
    // avant lui, l'assertion .not.toHaveBeenCalled() héritant son appel.
    (bcrypt.hash as jest.Mock).mockClear();
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

  it("ne recrée jamais de super-admin si un compte SUPER_ADMIN existe déjà", async () => {
    config.get.mockImplementation((key: string) =>
      key === "BOOTSTRAP_ADMIN_EMAIL" ? "admin@billetix.local" : "SuperSecret123!",
    );
    userRepo.findOne.mockResolvedValue({ id: "existing-super-admin" });

    await service.onModuleInit();

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { role: UserRole.SUPER_ADMIN } });
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("crée le premier super-admin quand aucun n'existe et que les variables sont définies", async () => {
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
        role: UserRole.SUPER_ADMIN,
        is_email_verified: true,
      }),
    );
  });

  it("promeut en SUPER_ADMIN le compte ADMIN déjà existant à cet email (déploiement pré-existant)", async () => {
    config.get.mockImplementation((key: string) =>
      key === "BOOTSTRAP_ADMIN_EMAIL" ? "admin@billetix.local" : "SuperSecret123!",
    );
    const legacyAdmin = { id: "legacy-admin", email: "admin@billetix.local", role: UserRole.ADMIN };
    userRepo.findOne
      .mockResolvedValueOnce(null) // aucun SUPER_ADMIN
      .mockResolvedValueOnce(legacyAdmin); // mais le compte bootstrap existe déjà en ADMIN

    await service.onModuleInit();

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: "legacy-admin", role: UserRole.SUPER_ADMIN }),
    );
  });

  it("ne promeut jamais un compte existant à cet email si son rôle n'est pas ADMIN", async () => {
    config.get.mockImplementation((key: string) =>
      key === "BOOTSTRAP_ADMIN_EMAIL" ? "admin@billetix.local" : "SuperSecret123!",
    );
    const unrelatedAccount = { id: "someone-else", email: "admin@billetix.local", role: UserRole.BUYER };
    userRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(unrelatedAccount);

    await service.onModuleInit();

    expect(userRepo.save).not.toHaveBeenCalled();
  });
});
