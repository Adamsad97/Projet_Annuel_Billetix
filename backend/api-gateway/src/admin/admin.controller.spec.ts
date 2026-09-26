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

describe("AdminController — annulation d'un transfert de billet", () => {
  const admin = { sub: "admin-1", email: "admin@billetix.local", role: "SUPER_ADMIN" } as any;
  const req = { headers: {}, ip: "127.0.0.1" } as any;
  const transfer = {
    id: "tr-1",
    ticket_id: "t1",
    ticket_reference: "TKT-1",
    event_name: "Concert",
    event_start_at: "2026-12-01T20:00:00.000Z",
    from_email: "jean@example.com",
    from_first_name: "Jean",
    from_holder_first_name: "Jean",
    from_holder_last_name: "Dupont",
    to_email: "marie@example.com",
    to_holder_first_name: "Paul",
    to_holder_last_name: "Martin",
  };
  const ticket = { id: "t1", reference: "TKT-1", unit_price_ttc: "50.00", holder_first_name: "Jean", holder_last_name: "Dupont" };

  let adminClient: { send: jest.Mock };
  let ticketClient: { send: jest.Mock };
  let notifClient: { emit: jest.Mock };
  let controller: AdminController;

  beforeEach(() => {
    adminClient = { send: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };
    ticketClient = { send: jest.fn((pattern: string) => of(pattern === "ticket.revert_transfer" ? { ticket, transfer } : { request: { id: "req-1" }, transfer })) };
    notifClient = { emit: jest.fn() };
    controller = new AdminController(
      adminClient as any,
      {} as any,
      {} as any,
      ticketClient as any,
      {} as any,
      {} as any,
      {} as any,
      notifClient as any,
    );
  });

  it("annule sur appel : billet rendu, audit et emails", async () => {
    await controller.revertTicketTransfer(admin, "tr-1", { reason: "Appel de l'acheteur", source: "PHONE" }, req);

    expect(ticketClient.send).toHaveBeenCalledWith(
      "ticket.revert_transfer",
      expect.objectContaining({ transfer_id: "tr-1", admin_id: "admin-1", source: "PHONE" }),
    );
    expect(adminClient.send).toHaveBeenCalledWith(
      "admin.log_action",
      expect.objectContaining({
        action: "TICKET_TRANSFER_REVERTED",
        reason: "Appel de l'acheteur",
        metadata: expect.objectContaining({ source: "PHONE", holder_before: "Paul Martin", holder_after: "Jean Dupont" }),
      }),
    );
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.transfer_reverted",
      expect.objectContaining({ senderEmail: "jean@example.com", recipientEmail: "marie@example.com" }),
    );
  });

  it("refuse une demande : motif journalisé et transmis à l'expéditeur", async () => {
    await controller.rejectTransferRevert(admin, "req-1", { reason: "Billet déjà remis" }, req);

    expect(adminClient.send).toHaveBeenCalledWith(
      "admin.log_action",
      expect.objectContaining({ action: "TICKET_TRANSFER_REVERT_REJECTED", reason: "Billet déjà remis" }),
    );
    expect(notifClient.emit).toHaveBeenCalledWith(
      "notification.transfer_revert_rejected",
      expect.objectContaining({ decisionReason: "Billet déjà remis" }),
    );
  });
});

describe("AdminController — reventes", () => {
  it("recherche par nom ou email partiel : inclut les comptes correspondants (vendeur ou acheteur)", async () => {
    const ticketClient = {
      send: jest.fn(() =>
        of({ data: [{ id: "r1", original_buyer_id: "u1", new_buyer_id: "u2", status: "SOLD" }], total: 1, page: 1, limit: 20 }),
      ),
    };
    const authClient = {
      send: jest.fn((pattern: string) =>
        of(
          pattern === "auth.list_users"
            ? { data: [{ id: "u1" }] }
            : [
                { id: "u1", email: "vendeur@example.com", first_name: "Jean", last_name: "Dupont" },
                { id: "u2", email: "acheteur@example.com", first_name: "Marie", last_name: "Martin" },
              ],
        ),
      ),
    };
    const controller = new AdminController(
      {} as any,
      {} as any,
      {} as any,
      ticketClient as any,
      {} as any,
      {} as any,
      authClient as any,
      {} as any,
    );

    const result = await controller.listResales("SOLD", " vendeur ");

    expect(authClient.send).toHaveBeenCalledWith("auth.list_users", { q: "vendeur", limit: 100 });
    expect(ticketClient.send).toHaveBeenCalledWith(
      "ticket.list_resales_admin",
      expect.objectContaining({ status: "SOLD", q: "vendeur", user_ids: ["u1"] }),
    );
    expect(result.data[0]).toMatchObject({
      seller: { email: "vendeur@example.com" },
      buyer: { email: "acheteur@example.com" },
    });
  });
});
