import { ForbiddenException } from "@nestjs/common";
import { assertCanBuyTickets, canHoldTickets } from "./purchase-roles";

describe("rôles sans billets", () => {
  it("refuse l'achat aux administrateurs et aux agents de contrôle", () => {
    expect(() => assertCanBuyTickets("AGENT")).toThrow("Un compte agent de contrôle ne peut pas acheter de billets.");
    expect(() => assertCanBuyTickets("ADMIN")).toThrow(ForbiddenException);
    expect(() => assertCanBuyTickets("SUPER_ADMIN")).toThrow(ForbiddenException);
  });

  it("autorise acheteurs et organisateurs", () => {
    expect(() => assertCanBuyTickets("BUYER")).not.toThrow();
    expect(() => assertCanBuyTickets("ORGANIZER")).not.toThrow();
  });

  it("un agent ne peut pas recevoir de billet offert", () => {
    expect(canHoldTickets("AGENT")).toBe(false);
    expect(canHoldTickets("BUYER")).toBe(true);
  });
});
