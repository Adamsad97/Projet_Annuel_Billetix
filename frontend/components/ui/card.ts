// Apparence commune des cartes (sections, listes, panneaux). Le remplissage
// reste propre à chaque usage : cardClass("p-5").

const CARD = "rounded-2xl border border-hairline-1 bg-card";

export function cardClass(extra = ""): string {
  return extra ? `${CARD} ${extra}` : CARD;
}
