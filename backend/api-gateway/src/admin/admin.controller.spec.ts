import { BadRequestException } from "@nestjs/common";
import { of } from "rxjs";
import { AdminController } from "./admin.controller";

// Instanciation directe (pas de TestingModule) : aucun test existant pour ce
// contrôleur, et seules les routes newsletter sont visées ici — pas besoin
// de câbler les guards/décorateurs HTTP pour ça.
describe("AdminController — newsletter", () => {
  let controller: AdminController;
  let adminClient: { send: jest.Mock };
  let userClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };
  let notifClient: { emit: jest.Mock };

  const fakeUser = { sub: "admin-1", email: "admin@billetix.local", role: "ADMIN" } as any;
  const fakeReq = { headers: {}, ip: "127.0.0.1" } as any;

  beforeEach(() => {
    adminClient = { send: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };
    userClient = { send: jest.fn() };
    authClient = { send: jest.fn() };
    notifClient = { emit: jest.fn() };

    controller = new AdminController(
      adminClient as any,
      userClient as any,
      {} as any, // eventClient
      {} as any, // ticketClient
      {} as any, // orderClient
      {} as any, // paymentClient
      authClient as any,
      notifClient as any,
    );
  });

  describe("getNewsletterRecipientsCount", () => {
    it("renvoie le nombre d'acheteurs abonnés", async () => {
      userClient.send.mockReturnValue(of(["user-1", "user-2", "user-3"]));

      const result = await controller.getNewsletterRecipientsCount();

      expect(result).toEqual({ count: 3 });
    });
  });

  describe("sendNewsletter", () => {
    it("rejette un envoi sans sujet ou sans contenu", async () => {
      await expect(
        controller.sendNewsletter(fakeUser, fakeReq, { subject: "  ", body: "Contenu" }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.sendNewsletter(fakeUser, fakeReq, { subject: "Sujet", body: "" }),
      ).rejects.toThrow(BadRequestException);
      expect(notifClient.emit).not.toHaveBeenCalled();
    });

    it("ne fait aucun appel supplémentaire quand personne n'est abonné", async () => {
      userClient.send.mockReturnValue(of([]));

      const result = await controller.sendNewsletter(fakeUser, fakeReq, {
        subject: "Sujet",
        body: "Contenu",
      });

      expect(result).toEqual({ sent: 0 });
      expect(authClient.send).not.toHaveBeenCalled();
      expect(notifClient.emit).not.toHaveBeenCalled();
    });

    it("émet un email par abonné et journalise l'action avec le nombre de destinataires", async () => {
      userClient.send.mockReturnValue(of(["user-1", "user-2"]));
      authClient.send.mockReturnValue(
        of([
          { email: "jean@test.com", first_name: "Jean" },
          { email: "marie@test.com", first_name: "Marie" },
        ]),
      );

      const result = await controller.sendNewsletter(fakeUser, fakeReq, {
        subject: "Nouveaux événements ce mois-ci",
        body: "Découvre les concerts à venir.",
      });

      expect(result).toEqual({ sent: 2 });
      expect(notifClient.emit).toHaveBeenCalledTimes(2);
      expect(notifClient.emit).toHaveBeenCalledWith("notification.newsletter", {
        email: "jean@test.com",
        firstName: "Jean",
        subject: "Nouveaux événements ce mois-ci",
        body: "Découvre les concerts à venir.",
      });
      expect(adminClient.send).toHaveBeenCalledWith(
        "admin.log_action",
        expect.objectContaining({
          action: "CUSTOM",
          metadata: { recipients_count: 2 },
        }),
      );
    });
  });
});
