/**
 * Politique de mot de passe appliquée à l'inscription, à la réinitialisation
 * et au changement depuis le profil. La longueur minimale vient de
 * platform_settings (password_min_length) — jamais figée ici.
 *
 * Miroir exact de frontend/lib/auth/password-policy.ts (affichage en temps
 * réel) : toute règle ajoutée ici doit l'être aussi là-bas. Le frontend
 * n'est qu'un confort d'affichage, ce contrôle-ci fait foi.
 */

export interface PasswordPersonalInfo {
  first_name?: string | null;
  last_name?: string | null;
  /** "YYYY-MM-DD" */
  birth_date?: string | null;
}

export const PERSONAL_INFO_VIOLATION =
  "Ne doit contenir ni votre prénom, ni votre nom, ni votre date de naissance";

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
  for (const raw of [info.first_name, info.last_name]) {
    if (!raw) continue;
    const full = normalize(raw).replace(/[^a-z0-9]/g, "");
    if (full.length >= MIN_PERSONAL_FRAGMENT_LENGTH) fragments.add(full);
    for (const part of normalize(raw).split(/[^a-z0-9]+/)) {
      if (part.length >= MIN_PERSONAL_FRAGMENT_LENGTH) fragments.add(part);
    }
  }
  return [...fragments];
}

/**
 * Formes usuelles d'une date de naissance, sans séparateurs : année seule,
 * jour+mois (anniversaire) et dates complètes (FR, ISO, US, année courte).
 * Comparées aux seuls chiffres du mot de passe, pour attraper aussi
 * "12/05/1998", "12-05-98" ou "1998.05.12".
 */
function birthDateFragments(birthDate?: string | null): string[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate ?? "");
  if (!match) return [];
  const [, yyyy, mm, dd] = match;
  const yy = yyyy.slice(2);
  return [yyyy, dd + mm, dd + mm + yyyy, dd + mm + yy, yyyy + mm + dd, mm + dd + yyyy];
}

/** Retourne la liste des règles non respectées (vide = mot de passe valide). */
export function getPasswordViolations(
  password: string,
  minLength: number,
  personalInfo: PasswordPersonalInfo = {},
): string[] {
  const violations: string[] = [];

  if (password.length < minLength) {
    violations.push(`Au moins ${minLength} caractères`);
  }
  if (!/\p{Lu}/u.test(password)) violations.push("Au moins une majuscule");
  if (!/\p{Ll}/u.test(password)) violations.push("Au moins une minuscule");
  if (!/\d/.test(password)) violations.push("Au moins un chiffre");
  if (!/[^\p{L}\d]/u.test(password)) {
    violations.push("Au moins un caractère spécial (ex : ! @ # ? -)");
  }

  const normalizedPassword = normalize(password);
  const passwordDigits = password.replace(/\D/g, "");
  if (
    personalFragments(personalInfo).some((f) => normalizedPassword.includes(f)) ||
    birthDateFragments(personalInfo.birth_date).some((f) => passwordDigits.includes(f))
  ) {
    violations.push(PERSONAL_INFO_VIOLATION);
  }

  return violations;
}
