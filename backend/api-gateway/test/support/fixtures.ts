import { PNG } from "pngjs";
import { get, post } from "./api";
import { waitForLinkToken } from "./mailpit";

/** Identifiant propre à l'exécution : les données créées par les tests sont reconnaissables (préfixe e2e-). */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const PASSWORD = "E2e-Billetix-Mdp-2026!";

export const testEmail = (label: string) => `e2e-${RUN_ID}-${label}@example.com`;

export interface Account {
  id: string;
  email: string;
  password: string;
  token: string;
  refreshToken: string;
}

/** Inscription, activation par le lien reçu par email, puis connexion : le parcours réel d'un nouvel utilisateur. */
export async function createVerifiedAccount(label: string, role: "BUYER" | "ORGANIZER" = "BUYER"): Promise<Account> {
  const email = testEmail(label);
  const register = await post("/auth/register", {
    email,
    password: PASSWORD,
    first_name: "Test",
    last_name: role === "ORGANIZER" ? "Organisateur" : "Acheteur",
    birth_date: "1990-05-15",
    role,
  });
  if (register.status !== 201)
    throw new Error(`Inscription ${email} : ${register.status} ${JSON.stringify(register.body)}`);

  const { token } = await waitForLinkToken(email, "/auth/verify-email");
  const verify = await get(`/auth/verify-email?token=${token}`);
  if (verify.status !== 200) throw new Error(`Vérification ${email} : ${verify.status} ${JSON.stringify(verify.body)}`);

  return login(email, PASSWORD);
}

export async function login(email: string, password: string): Promise<Account> {
  const response = await post("/auth/login", { email, password });
  if (response.status !== 200 || !response.body?.access_token) {
    throw new Error(`Connexion ${email} : ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    id: response.body.user.id,
    email,
    password,
    token: response.body.access_token,
    refreshToken: response.body.refresh_token,
  };
}

/** Compte administrateur de la pile testée (admin initial par défaut) ; absent → les tests qui en dépendent sont ignorés. */
export const adminCredentials = () => {
  const email = process.env.E2E_ADMIN_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
};

/** Petite image PNG valide, pour l'affiche d'un événement. */
export function pngImage(size = 64): Buffer {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 30;
    png.data[i + 1] = 90;
    png.data[i + 2] = 200;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

export const minutesFromNow = (minutes: number) => {
  const date = new Date(Date.now() + minutes * 60 * 1000);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
};
