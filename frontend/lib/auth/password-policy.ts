// Miroir de backend/auth-service/src/auth/password-policy.ts, pour
// l'affichage en temps réel : toute règle ajoutée là-bas doit l'être ici.
// Simple confort de saisie — auth-service refait le contrôle et fait foi.

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

/**
 * État de chaque règle affichée en direct pendant la saisie. La règle
 * « prénom / nom » n'en fait volontairement pas partie (demande produit) :
 * elle n'est vérifiée qu'à l'envoi, via containsPersonalInfo().
 */
export function evaluatePassword(password: string, minLength: number): PasswordRuleStatus[] {
  const rules: PasswordRuleStatus[] = [
    { id: "length", label: `${minLength} caractères min.`, ok: password.length >= minLength },
    { id: "upper", label: "Majuscule", ok: /\p{Lu}/u.test(password) },
    { id: "lower", label: "Minuscule", ok: /\p{Ll}/u.test(password) },
    { id: "digit", label: "Chiffre", ok: /\d/.test(password) },
    { id: "special", label: "Caractère spécial", hint: "Par exemple ! @ # ? - _", ok: /[^\p{L}\d]/u.test(password) },
  ];

  return rules;
}

/**
 * Contrôle à l'envoi du formulaire : le mot de passe contient-il le prénom,
 * le nom ou la date de naissance ? Inconnus sur la page de réinitialisation
 * (pas de session) — seul le serveur peut alors le vérifier.
 */
export function containsPersonalInfo(password: string, personalInfo: PasswordPersonalInfo): boolean {
  const normalizedPassword = normalize(password);
  const passwordDigits = password.replace(/\D/g, "");
  return (
    personalFragments(personalInfo).some((f) => normalizedPassword.includes(f)) ||
    birthDateFragments(personalInfo.birthDate).some((f) => passwordDigits.includes(f))
  );
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

export const PERSONAL_INFO_ERROR =
  "Le mot de passe ne doit contenir ni votre prénom, ni votre nom, ni votre date de naissance.";
