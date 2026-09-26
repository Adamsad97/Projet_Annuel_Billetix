"use client";

// Bascule clair / sombre. Icônes au trait (même style que les autres
// pictogrammes du site) plutôt que des emojis, dont le rendu varie selon le
// système et jure avec l'interface. Les deux icônes sont superposées et
// permutent avec un léger fondu + rotation.

import { useTheme } from "@/lib/theme/theme-provider";

const iconClass =
  "absolute h-[18px] w-[18px] transition-all duration-300 ease-out motion-reduce:transition-none";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Passer en mode sombre" : "Passer en mode clair"}
      title={isLight ? "Mode sombre" : "Mode clair"}
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-hairline-2 text-ink-3 transition-colors hover:border-hairline-4 hover:bg-hairline-1 hover:text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      {/* Lune : proposée en mode clair */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`${iconClass} ${isLight ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
      >
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
      </svg>

      {/* Soleil : proposé en mode sombre */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`${iconClass} ${isLight ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    </button>
  );
}
