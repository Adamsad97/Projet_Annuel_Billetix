import type { ReactNode } from "react";

// Pictogrammes au trait (grille 24×24). Les catégories étant libres côté admin,
// l'icône suit d'abord l'emoji qu'il a choisi, puis un mot-clé du code, le
// billet en dernier recours.
const ICONS: { emojis: string[]; keys: string[]; paths: ReactNode }[] = [
  {
    emojis: ["🎵", "🎶", "🎧", "🎤", "🎸", "🎹", "🎷", "🎺", "🥁", "🎻", "🎼"],
    keys: ["CONCERT", "MUSIQUE", "MUSIC"],
    paths: (<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>),
  },
  {
    emojis: ["🎭", "🤡", "🤹"],
    keys: ["SPECTACLE", "THEATRE", "HUMOUR", "SHOW"],
    paths: (<><path d="M4 4h16v6a8 8 0 0 1-16 0Z" /><path d="M9 9h.01M15 9h.01" /><path d="M9 13a3 3 0 0 0 6 0" /></>),
  },
  {
    emojis: ["🎓", "📚", "📖", "✏️", "📝", "🏫"],
    keys: ["FORMATION", "ATELIER", "COURS", "EDUCATION"],
    paths: (<><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /><path d="M22 10v6" /></>),
  },
  {
    emojis: ["🏆", "🥇", "🥈", "🥉", "🏅", "🎖️"],
    keys: ["COMPETITION", "TOURNOI", "CHAMPIONNAT"],
    paths: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /><path d="M12 15v4M8 22h8M9 22a3 3 0 0 1 6 0" /></>),
  },
  {
    emojis: ["🎬", "🎥", "🍿", "📽️", "🎞️"],
    keys: ["CINEMA", "FILM", "PROJECTION"],
    paths: (<><rect x="2" y="2" width="20" height="20" rx="2.5" /><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" /></>),
  },
  {
    emojis: ["🍽️", "🍴", "🍕", "🍔", "🍰", "🍣", "🥘", "🍜", "🍷", "🧑‍🍳", "👨‍🍳", "👩‍🍳"],
    keys: ["GASTRONOMIE", "CUISINE", "DEGUSTATION", "FOOD"],
    paths: (<><path d="M3 2v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3Zm0 0v7" /></>),
  },
  {
    emojis: ["🧭", "🏕️", "🎡", "🎢", "🌴", "🏖️", "🗺️"],
    keys: ["LOISIR", "DECOUVERTE", "EXCURSION", "VISITE"],
    paths: (<><circle cx="12" cy="12" r="10" /><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" /></>),
  },
  {
    emojis: ["💼", "📊", "📈", "🤝", "🏢"],
    keys: ["BUSINESS", "AFFAIRE", "SALON", "NETWORKING"],
    paths: (<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>),
  },
  {
    emojis: ["🍸", "🍹", "🥂", "🎉", "🎊", "🪩", "🍾", "🕺"],
    keys: ["SOIREE", "FETE", "PARTY", "CLUB"],
    paths: (<><path d="m19 3-7 8-7-8Z" /><path d="M12 11v11M8 22h8" /></>),
  },
  {
    emojis: ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🏃", "🏋️", "🚴", "🥊", "⛹️", "🏊"],
    keys: ["SPORT", "MATCH"],
    paths: (<><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" /></>),
  },
  {
    emojis: ["🎪", "⛺"],
    keys: ["FESTIVAL"],
    paths: (<><path d="M3.5 21 14 3M20.5 21 10 3" /><path d="M15.5 21 12 15l-3.5 6M2 21h20" /></>),
  },
  {
    emojis: ["💃", "🩰"],
    keys: ["DANSE", "BALLET"],
    paths: (<><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z" /><path d="M19 3v4M21 5h-4" /></>),
  },
  {
    emojis: ["💡", "🎙️", "📢", "🗣️"],
    keys: ["CONFERENCE", "SEMINAIRE", "TALK"],
    paths: (<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></>),
  },
  {
    emojis: ["🎲", "🎮", "🕹️", "♟️", "🃏", "🧩"],
    keys: ["JEUX", "GAME", "LUDIQUE"],
    paths: (<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3" /></>),
  },
  {
    emojis: ["🎨", "🖼️", "🏛️"],
    keys: ["EXPOSITION", "EXPO", "ARTS", "MUSEE", "CULTURE"],
    paths: (<><path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-4 3.5h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22Z" /><path d="M7.5 10.5h.01M10.5 7h.01M15 7.5h.01M17 11h.01" strokeWidth="3" /></>),
  },
];

const TICKET = (<><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 11v2M13 17v2" /></>);

// Le sélecteur de variante (U+FE0F) est facultatif : « ⚽ » et « ⚽️ » se valent.
function bareEmoji(emoji: string): string {
  return emoji.replace(/️/g, "").trim();
}

function normalizeCode(code: string): string {
  return code.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function iconPaths(code: string, emoji: string | null): ReactNode {
  if (emoji) {
    const bare = bareEmoji(emoji);
    const byEmoji = ICONS.find((icon) => icon.emojis.some((e) => bareEmoji(e) === bare));
    if (byEmoji) return byEmoji.paths;
  }
  const key = normalizeCode(code);
  return ICONS.find((icon) => icon.keys.some((k) => key.includes(k)))?.paths ?? TICKET;
}

export function CategoryIcon({
  code,
  emoji = null,
  className,
  strokeWidth = 1.75,
}: {
  code: string;
  /** Emoji choisi par l'admin : prioritaire pour le choix de l'icône. */
  emoji?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {iconPaths(code, emoji)}
    </svg>
  );
}
