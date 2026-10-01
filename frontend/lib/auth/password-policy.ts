import { t, msg } from "@/lib/i18n/translate";
// Miroir de la politique de mot de passe d'auth-service pour l'affichage en direct ; le serveur fait foi.

export interface PasswordPersonalInfo {
  firstName?: string | null;
  lastName?: string | null;
  /** "YYYY-MM-DD" */
  birthDate?: string | null;
}

export interface PasswordRuleStatus {
  id: string;
  /** Libellé court, affiché dans une pastille. */
  label: string;
  /** Précision affichée au survol (et lue par les lecteurs d'écran). */
  hint?: string;
  ok: boolean;
}

// En dessous, un fragment de nom est trop court pour être significatif
// (ex: "Li", "Ba") et bloquerait des mots de passe légitimes.
const MIN_PERSONAL_FRAGMENT_LENGTH = 3;

/** Minuscules sans accents : "Éloïse" et "eloise" doivent être équivalents. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "Jean-Marie de la Tour" → ["jean", "marie", "tour"] (+ forme complète). */
function personalFragments(info: PasswordPersonalInfo): string[] {
  const fragments = new Set<string>();
  for (const raw of [info.firstName, info.lastName]) {
    if (!raw) continue;
    const full = normalize(raw).replace(/[^a-z0-9]/g, "");
    if (full.length >= MIN_PERSONAL_FRAGMENT_LENGTH) fragments.add(full);
    for (const part of normalize(raw).split(/[^a-z0-9]+/)) {
      if (part.length >= MIN_PERSONAL_FRAGMENT_LENGTH) fragments.add(part);
    }
  }
  return [...fragments];
}

/** État des règles affichées en direct ; la règle prénom/nom n'est vérifiée qu'à l'envoi. */
export function evaluatePassword(password: string, minLength: number): PasswordRuleStatus[] {
  const rules: PasswordRuleStatus[] = [
    { id: "length", label: t("{minLength} caractères min.", { minLength }), ok: password.length >= minLength },
    { id: "upper", label: t("Majuscule"), ok: /\p{Lu}/u.test(password) },
    { id: "lower", label: t("Minuscule"), ok: /\p{Ll}/u.test(password) },
    { id: "digit", label: t("Chiffre"), ok: /\d/.test(password) },
    { id: "special", label: t("Caractère spécial"), hint: t("Par exemple ! @ # ? - _"), ok: /[^\p{L}\d]/u.test(password) },
  ];

  return rules;
}

/** À l'envoi : le mot de passe contient-il prénom, nom ou date de naissance ? (sans session, seul le serveur vérifie) */
export function containsPersonalInfo(password: string, personalInfo: PasswordPersonalInfo): boolean {
  const normalizedPassword = normalize(password);
  const passwordDigits = password.replace(/\D/g, "");
  return (
    personalFragments(personalInfo).some((f) => normalizedPassword.includes(f)) ||
    birthDateFragments(personalInfo.birthDate).some((f) => passwordDigits.includes(f))
  );
}

/** Formes usuelles d'une date de naissance sans séparateurs, comparées aux chiffres du mot de passe. */
function birthDateFragments(birthDate?: string | null): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate ?? "");
  if (!match) return [];
  const [, yyyy, mm, dd] = match;
  const yy = yyyy.slice(2);
  return [yyyy, dd + mm, dd + mm + yyyy, dd + mm + yy, yyyy + mm + dd, mm + dd + yyyy];
}

export const PERSONAL_INFO_ERROR =
  msg("Le mot de passe ne doit contenir ni votre prénom, ni votre nom, ni votre date de naissance.");
