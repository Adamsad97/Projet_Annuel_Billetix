// Apparence commune des champs de formulaire. Le remplissage et la largeur
// restent propres à chaque usage : fieldClass("px-4 py-3").

const FIELD =
  "rounded-xl border border-hairline-2 bg-hairline-1 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

export function fieldClass(extra = ""): string {
  return extra ? `${FIELD} ${extra}` : FIELD;
}

/** Liste déroulante de tri ou de filtre au-dessus d'une liste. */
export const filterSelectClass =
  "h-10 rounded-full border border-hairline-3 bg-card px-4 text-sm font-medium text-ink-2 focus:border-blue-500 focus:outline-none";
