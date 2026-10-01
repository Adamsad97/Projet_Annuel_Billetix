import { of } from "rxjs";
import { CreditNoteIssuer } from "./credit-note-issuer.service";

describe("CreditNoteIssuer — avoir après un remboursement", () => {
  const config = {
    tva_rate: 0.2,
    platform_legal_name: "BilleTix SAS",
    platform_siret: "",
    platform_vat_number: "",
    platform_address: "",
  };
  const issued = {
    credit_note: {
      id: "note-1",
      number: "AV-2026-00001",
      amount_ht: "98.00",
      tva_amount: "19.60",
      fees_amount: "2.40",
      amount_ttc: "120.00",
      reason: "Annulation de l'événement",
      created_at: "2026-10-01T10:00:00.000Z",
    },
    order: {
      reference: "ORD-2026-ABCDE",
      event_name: "Soirée Jazz",
      billing_first_name: "Awa",
      billing_last_name: "Diallo",
      billing_email: "awa@example.com",
      billing_address_line1: "1 rue",
      billing_address_line2: null,
      billing_city: "Paris",
      billing_postal_code: "75001",
      billing_country: "France",
    },
  };

  function setup(answer: unknown) {
    const orderClient = { send: jest.fn(() => of(answer)) };
    const pdfClient = { emit: jest.fn() };
    const adminClient = { send: jest.fn(() => of(config)) };
    const issuer = new CreditNoteIssuer(orderClient as never, pdfClient as never, adminClient as never);
    return { issuer, orderClient, pdfClient };
  }

  it("enregistre l'avoir puis demande son PDF, montants convertis en nombres", async () => {
    const { issuer, orderClient, pdfClient } = setup(issued);
    await expect(issuer.issue("order-1", undefined, "Annulation de l'événement")).resolves.toBe("AV-2026-00001");
    expect(orderClient.send).toHaveBeenCalledWith("order.issue_credit_note", {
      order_id: "order-1",
      amount_ttc: undefined,
      reason: "Annulation de l'événement",
    });
    expect(pdfClient.emit).toHaveBeenCalledWith(
      "pdf.generate_credit_note",
      expect.objectContaining({ number: "AV-2026-00001", invoice_reference: "ORD-2026-ABCDE", amount_ttc: 120, tva_rate: 0.2 }),
    );
  });

  it("rien à émettre (réservation gratuite ou facture déjà couverte) : pas de PDF", async () => {
    const { issuer, pdfClient } = setup(null);
    await expect(issuer.issue("order-1", 10, "x")).resolves.toBeNull();
    expect(pdfClient.emit).not.toHaveBeenCalled();
  });
});
