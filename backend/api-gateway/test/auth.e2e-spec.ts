import { API_URL, del, errorMessage, get, post } from "./support/api";
import { Account, PASSWORD, createVerifiedAccount, login, testEmail } from "./support/fixtures";
import { waitForLinkToken } from "./support/mailpit";

/** Parcours d'authentification complet, de l'inscription à la suppression du compte (RGPD). */
describe("Authentification (fonctionnel)", () => {
  let account: Account;
  const NEW_PASSWORD = "E2e-Nouveau-Mdp-2026!";

  it("refuse une inscription dont le mot de passe ne respecte pas la politique (CNIL)", async () => {
    const response = await post("/auth/register", {
      email: testEmail("faible"),
      password: "court",
      first_name: "Test",
      last_name: "Faible",
      birth_date: "1990-05-15",
    });
    expect(response.status).toBe(400);
  });

  it("inscrit, envoie le lien d'activation, puis ouvre la session une fois l'adresse vérifiée", async () => {
    account = await createVerifiedAccount("auth");
    expect(account.token).toEqual(expect.any(String));

    const me = await get("/auth/me", account.token);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: account.email, role: "BUYER" });
    expect(me.body).not.toHaveProperty("password_hash");
  });

  it("refuse une seconde inscription avec la même adresse", async () => {
    const response = await post("/auth/register", {
      email: account.email,
      password: PASSWORD,
      first_name: "Test",
      last_name: "Doublon",
      birth_date: "1990-05-15",
    });
    expect(response.status).toBe(409);
  });

  it("refuse un mauvais mot de passe sans dire si le compte existe", async () => {
    const wrongPassword = await post("/auth/login", { email: account.email, password: "Mauvais-Mdp-2026!" });
    const unknownAccount = await post("/auth/login", { email: testEmail("inconnu"), password: "Mauvais-Mdp-2026!" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(errorMessage(wrongPassword)).toBe(errorMessage(unknownAccount));
  });

  it("renouvelle la session par rotation du refresh token, puis la déconnexion la ferme pour tous ses jetons", async () => {
    const previousRefreshToken = account.refreshToken;
    const refreshed = await post("/auth/refresh", { refresh_token: previousRefreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toEqual(expect.any(String));
    expect(refreshed.body.refresh_token).not.toBe(previousRefreshToken);

    // Délai de grâce (plusieurs onglets) : l'ancien jeton rejoué aussitôt rend la même nouvelle session, pas une seconde.
    const replay = await post("/auth/refresh", { refresh_token: previousRefreshToken });
    expect(replay.body.refresh_token).toBe(refreshed.body.refresh_token);

    expect((await post("/auth/logout", { refresh_token: refreshed.body.refresh_token })).status).toBe(200);
    expect((await post("/auth/refresh", { refresh_token: refreshed.body.refresh_token })).status).toBe(401);
    expect((await post("/auth/refresh", { refresh_token: previousRefreshToken })).status).toBe(401);
  });

  it("réinitialise le mot de passe oublié par le lien reçu par email, à usage unique", async () => {
    const forgot = await post("/auth/forgot-password", { email: account.email });
    expect(forgot.status).toBe(200);

    const { token } = await waitForLinkToken(account.email, "/auth/reset-password");
    const reset = await post("/auth/reset-password", { token, new_password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    const reuse = await post("/auth/reset-password", { token, new_password: "E2e-Autre-Mdp-2026!" });
    expect(reuse.status).toBe(400);

    expect((await post("/auth/login", { email: account.email, password: PASSWORD })).status).toBe(401);
    account = await login(account.email, NEW_PASSWORD);
  });

  it("connexion par lien magique : lien reçu par email, à usage unique, seul le dernier demandé valable", async () => {
    const unknown = await post("/auth/magic-link", { email: testEmail("inconnu") });
    expect(unknown.status).toBe(200);

    expect((await post("/auth/magic-link", { email: account.email })).body).toEqual(unknown.body);
    const first = await waitForLinkToken(account.email, "/auth/magic-link");

    expect((await post("/auth/magic-link", { email: account.email })).status).toBe(200);
    const second = await waitForLinkToken(account.email, "/auth/magic-link", [first.id]);

    expect((await post("/auth/magic-link/verify", { token: first.token })).status).toBe(400);

    const session = await post("/auth/magic-link/verify", { token: second.token });
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ id: account.id, email: account.email });
    expect((await get("/auth/me", session.body.access_token)).status).toBe(200);

    expect((await post("/auth/magic-link/verify", { token: second.token })).status).toBe(400);
    account = { ...account, token: session.body.access_token, refreshToken: session.body.refresh_token };
  });

  it("exporte toutes les données du compte en JSON téléchargeable, sans aucun secret (RGPD)", async () => {
    const response = await fetch(`${API_URL}/users/me/export`, {
      headers: { Authorization: `Bearer ${account.token}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="billetix-mes-donnees-.+\.json"$/,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    const data = await response.json();
    expect(data.account).toMatchObject({ id: account.id, email: account.email, first_name: "Test" });
    expect(data.buyer).toEqual(expect.objectContaining({ orders: [], tickets: [] }));
    expect(data.organizer).toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/password_hash|two_factor_secret|qr_code_token|refresh_token/);
  });

  it("supprime définitivement le compte à la demande de l'utilisateur (RGPD)", async () => {
    const deletion = await del("/users/me", { password: NEW_PASSWORD }, account.token);
    expect(deletion.status).toBe(200);
    expect((await post("/auth/login", { email: account.email, password: NEW_PASSWORD })).status).toBe(401);
  });
});
