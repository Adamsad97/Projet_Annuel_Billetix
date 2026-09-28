import { RpcException } from "@nestjs/microservices";
import { ChangeRolePayload, IdsPayload, OAuthExchangePayload } from "./payloads";
import { rpcValidationPipe } from "./rpc-validation";

const pipe = rpcValidationPipe();
const ID = "11111111-1111-4111-8111-111111111111";

async function run(metatype: new () => object, value: unknown) {
  return pipe.transform(value, { type: "body", metatype });
}

describe("Validation des messages internes (auth-service)", () => {
  it("conserve la session complète (jetons + utilisateur) pour l'échange OAuth", async () => {
    const session = { access_token: "a.b.c", refresh_token: "d.e.f", user: { id: ID, email: "x@example.com", role: "BUYER" } };
    await expect(run(OAuthExchangePayload, session)).resolves.toEqual(session);
  });

  it("conserve les étapes intermédiaires OAuth (2FA, date de naissance)", async () => {
    const twoFactor = { requires_2fa: true, two_factor_method: "TOTP", pending_token: "abc" };
    const birthDate = { requires_birth_date: true, pending_token: "def", first_name: "Awa" };
    await expect(run(OAuthExchangePayload, twoFactor)).resolves.toEqual(twoFactor);
    await expect(run(OAuthExchangePayload, birthDate)).resolves.toEqual(birthDate);
  });

  it("refuse un rôle inconnu, en 400", async () => {
    await expect(run(ChangeRolePayload, { id: ID, admin_id: ID, actor_role: "SUPER_ADMIN", role: "ROI" })).rejects.toBeInstanceOf(
      RpcException,
    );
  });

  it("tolère des identifiants mal formés dans une résolution par lot", async () => {
    await expect(run(IdsPayload, { ids: [ID, "identifiant-invalide"] })).resolves.toEqual({ ids: [ID, "identifiant-invalide"] });
  });
});
