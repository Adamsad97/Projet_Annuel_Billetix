import { ServiceUnavailableException } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { of, throwError } from "rxjs";
import { JwtPayload } from "../common/decorators/current-user.decorator";
import { UserDataExportService, withoutSecrets } from "./data-export.service";

type Responses = Record<string, unknown | Error>;

function client(responses: Responses): ClientProxy {
  return {
    send: jest.fn((pattern: string) => {
      const response = responses[pattern];
      return response instanceof Error ? throwError(() => response) : of(response ?? []);
    }),
  } as unknown as ClientProxy;
}

const notFound = Object.assign(new Error("introuvable"), { statusCode: 404 });

describe("UserDataExportService", () => {
  const buyer = { sub: "user-1", email: "awa@example.com", role: "BUYER" } as JwtPayload;
  const organizer = { ...buyer, role: "ORGANIZER" } as JwtPayload;

  function build(responses: Responses) {
    const shared = client(responses);
    return new UserDataExportService(shared, shared, shared, shared, shared, shared);
  }

  const baseResponses: Responses = {
    "auth.get_user": {
      id: "user-1",
      email: "awa@example.com",
      first_name: "Awa",
      password_changed_at: "2026-09-01T10:00:00.000Z",
      two_factor_secret: "JBSWY3DPEHPK3PXP",
      password_hash: "$2b$12$...",
    },
    "user.get_buyer_profile": { user_id: "user-1", city: "Paris" },
    "user.get_notification_prefs": { marketing: false },
    "order.list_by_buyer": [{ id: "order-1", billing_email: "awa@example.com", reservation_token: "rsv" }],
    "ticket.get_by_buyer": [{ id: "ticket-1", holder_first_name: "Awa", qr_code_token: "secret-qr" }],
    "payment.get_disputes_by_buyer": [{ id: "dispute-1" }],
  };

  it("réunit les données de chaque service, sans aucun secret", async () => {
    const data = await build(baseResponses).build(buyer);

    expect(data.format).toContain("RGPD");
    expect(data.account).toEqual({
      id: "user-1",
      email: "awa@example.com",
      first_name: "Awa",
      password_changed_at: "2026-09-01T10:00:00.000Z",
    });
    expect(data.buyer.profile).toEqual({ user_id: "user-1", city: "Paris" });
    expect(data.buyer.orders).toEqual([{ id: "order-1", billing_email: "awa@example.com" }]);
    expect(data.buyer.tickets).toEqual([{ id: "ticket-1", holder_first_name: "Awa" }]);
    expect(data.buyer.disputes).toEqual([{ id: "dispute-1" }]);
    expect(data.organizer).toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/secret-qr|JBSWY3DPEHPK3PXP|\$2b\$/);
  });

  it("ajoute l'activité d'organisateur (profil, événements, reversements) pour un organisateur", async () => {
    const data = await build({
      ...baseResponses,
      "user.get_organizer_profile": {
        display_name: "Asso Awa",
        iban_masked: "FR76 •••• 1234",
        iban_encrypted: "chiffré",
      },
      "event.list_by_organizer": [{ id: "event-1", title: "Concert" }],
      "payment.get_payouts_by_organizer": [{ id: "payout-1", net_amount: 120 }],
    }).build(organizer);

    expect(data.organizer).toEqual({
      profile: { display_name: "Asso Awa", iban_masked: "FR76 •••• 1234" },
      events: [{ id: "event-1", title: "Concert" }],
      payouts: [{ id: "payout-1", net_amount: 120 }],
    });
  });

  it("un profil absent est exporté vide, pas en erreur", async () => {
    const data = await build({ ...baseResponses, "user.get_buyer_profile": notFound }).build(buyer);
    expect(data.buyer.profile).toBeNull();
  });

  it("tout ou rien : un service indisponible fait échouer l'export plutôt que d'en livrer un incomplet", async () => {
    await expect(
      build({ ...baseResponses, "order.list_by_buyer": new Error("délai dépassé") }).build(buyer),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("le filtre des secrets descend dans toutes les profondeurs et garde les dates", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    expect(withoutSecrets({ a: [{ b: { refresh_token: "x", kept: date } }], iban_iv: "iv", iban_tag: "tag" })).toEqual({
      a: [{ b: { kept: date } }],
    });
  });
});
