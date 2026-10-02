import { errorMessage, get, post } from "./support/api";

/** Protections transverses de la passerelle : authentification, validation des entrées, catalogue public. */
describe("Contrôle d'accès et validation (fonctionnel)", () => {
  it("expose le catalogue public sans connexion", async () => {
    const events = await get("/events");
    expect(events.status).toBe(200);
  });

  it.each([
    ["GET", "/auth/me"],
    ["GET", "/orders/me"],
    ["GET", "/tickets/mine"],
    ["GET", "/admin/kyc/pending-count"],
  ])("refuse %s %s sans jeton (401)", async (_method, path) => {
    expect((await get(path)).status).toBe(401);
  });

  it("refuse un jeton falsifié", async () => {
    const forged =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      Buffer.from(JSON.stringify({ sub: "00000000-0000-4000-8000-000000000000", role: "ADMIN" })).toString(
        "base64url",
      ) +
      ".signature-invalide";
    expect((await get("/admin/kyc/pending-count", forged)).status).toBe(401);
  });

  it("rejette les champs inconnus d'une requête (liste blanche)", async () => {
    const response = await post("/auth/login", { email: "e2e@example.com", password: "x", role: "ADMIN" });
    expect(response.status).toBe(400);
  });

  it("rejette un identifiant mal formé avant d'interroger les services", async () => {
    const response = await get("/events/pas-un-uuid/categories");
    expect(response.status).toBe(400);
    expect(errorMessage(response)).not.toBe("");
  });

  it("répond 404 sur un événement inexistant", async () => {
    expect((await get("/events/00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});
