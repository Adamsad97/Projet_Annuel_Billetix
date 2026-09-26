// Petit drapeau pour la pastille « pays » des cartes d'événement.
// Dessiné en SVG plutôt qu'en emoji : Windows n'affiche pas les emojis de
// drapeaux (juste deux lettres). Le pays étant saisi en texte libre
// ("France", "Guinée"...), la correspondance se fait sur le nom normalisé ;
// pays non couvert → icône globe neutre, jamais un drapeau faux.

type Flag = { stripes: string[]; direction: "vertical" | "horizontal"; star?: string };

const FLAGS: Record<string, Flag> = {
  france: { stripes: ["#0055a4", "#ffffff", "#ef4135"], direction: "vertical" },
  guinee: { stripes: ["#ce1126", "#fcd116", "#009460"], direction: "vertical" },
  mali: { stripes: ["#14b53a", "#fcd116", "#ce1126"], direction: "vertical" },
  senegal: { stripes: ["#00853f", "#fdef42", "#e31b23"], direction: "vertical", star: "#00853f" },
  cameroun: { stripes: ["#007a5e", "#ce1126", "#fcd116"], direction: "vertical", star: "#fcd116" },
  "cote d'ivoire": { stripes: ["#f77f00", "#ffffff", "#009e60"], direction: "vertical" },
  belgique: { stripes: ["#000000", "#fdda24", "#ef3340"], direction: "vertical" },
  italie: { stripes: ["#009246", "#ffffff", "#ce2b37"], direction: "vertical" },
  irlande: { stripes: ["#169b62", "#ffffff", "#ff883e"], direction: "vertical" },
  tchad: { stripes: ["#002664", "#fecb00", "#c60c30"], direction: "vertical" },
  nigeria: { stripes: ["#008751", "#ffffff", "#008751"], direction: "vertical" },
  allemagne: { stripes: ["#000000", "#dd0000", "#ffce00"], direction: "horizontal" },
  gabon: { stripes: ["#009e60", "#fcd116", "#3a75c4"], direction: "horizontal" },
  "pays-bas": { stripes: ["#ae1c28", "#ffffff", "#21468b"], direction: "horizontal" },
  luxembourg: { stripes: ["#ed2939", "#ffffff", "#00a1de"], direction: "horizontal" },
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .trim()
    .toLowerCase();
}

export function CountryFlag({ country }: { country: string }) {
  const flag = FLAGS[normalize(country)];

  if (!flag) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
      </svg>
    );
  }

  const vertical = flag.direction === "vertical";
  return (
    <svg width="18" height="13" viewBox="0 0 18 12" aria-hidden="true" className="shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10">
      {flag.stripes.map((color, i) =>
        vertical ? (
          <rect key={i} x={i * 6} y="0" width="6" height="12" fill={color} />
        ) : (
          <rect key={i} x="0" y={i * 4} width="18" height="4" fill={color} />
        ),
      )}
      {flag.star ? (
        <polygon
          points="9,4 9.59,5.69 11.38,5.73 9.95,6.81 10.47,8.52 9,7.5 7.53,8.52 8.05,6.81 6.62,5.73 8.41,5.69"
          fill={flag.star}
        />
      ) : null}
    </svg>
  );
}
