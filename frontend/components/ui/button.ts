// Apparence commune des boutons et liens-boutons. Taille, marges et largeur
// restent propres à chaque usage : buttonClass("primary", "px-5 py-2.5").

const VARIANTS = {
  /** Action principale : fond bleu, ombre portée. */
  primary: "bg-blue-700 font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90",
  /** Action secondaire : contour discret. */
  secondary: "border border-hairline-3 font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClass(variant: ButtonVariant, extra = ""): string {
  return extra ? `${VARIANTS[variant]} ${extra}` : VARIANTS[variant];
}
