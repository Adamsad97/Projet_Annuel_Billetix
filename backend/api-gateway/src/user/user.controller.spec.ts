import { ForbiddenException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { of } from "rxjs";
import { AdminRecipients } from "../admin-alerts/admin-recipients.service";
import { JwtPayload } from "../common/decorators/current-user.decorator";
import { UserDataExportService } from "./data-export.service";
import { UserController } from "./user.controller";

describe("UserController — export RGPD", () => {
  const exported = {
    format: "BilleTix",
    generated_at: "2026-10-02T14:00:00.000Z",
    account: {},
    buyer: {},
    organizer: null,
  };
  let adminClient: { send: jest.Mock };
  let dataExport: { build: jest.Mock };
  let controller: UserController;
  const res = { setHeader: jest.fn() } as unknown as Response;
  const req = { headers: {}, ip: "203.0.113.7" } as unknown as Request;

  beforeEach(() => {
    adminClient = {
      send: jest.fn((pattern: string) =>
        of(pattern === "admin.get_platform_config" ? { sensitive_action_reauth_minutes: 5 } : { success: true }),
      ),
    };
    dataExport = { build: jest.fn().mockResolvedValue(exported) };
    const unused = {} as ClientProxy;
    controller = new UserController(
      unused,
      unused,
      unused,
      unused,
      adminClient as unknown as ClientProxy,
      {} as ConfigService,
      {} as AdminRecipients,
      dataExport as unknown as UserDataExportService,
    );
    (res.setHeader as jest.Mock).mockClear();
  });

  const user = (minutesSinceLogin: number) =>
    ({
      sub: "user-1",
      email: "awa@example.com",
      role: "BUYER",
      auth_time: Math.floor(Date.now() / 1000) - minutesSinceLogin * 60,
    }) as JwtPayload;

  it("exige une connexion récente (réglage sensitive_action_reauth_minutes)", async () => {
    await expect(controller.exportMyData(user(6), req, res)).rejects.toThrow(ForbiddenException);
    expect(dataExport.build).not.toHaveBeenCalled();
  });

  it("renvoie le fichier en téléchargement, non mis en cache, et trace l'export dans le journal d'audit", async () => {
    await expect(controller.exportMyData(user(1), req, res)).resolves.toBe(exported);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="billetix-mes-donnees-2026-10-02.json"',
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(adminClient.send).toHaveBeenCalledWith(
      "admin.log_action",
      expect.objectContaining({
        action: "USER_DATA_EXPORTED",
        entity_id: "user-1",
        performed_by: "user-1",
        ip_address: "203.0.113.7",
      }),
    );
  });
});
