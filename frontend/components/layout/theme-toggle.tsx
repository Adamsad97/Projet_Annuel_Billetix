"use client";

import { useTheme } from "@/lib/theme/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
      title={theme === "light" ? "Mode sombre" : "Mode clair"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline-2 text-ink-3 transition-colors hover:border-hairline-4 hover:text-ink-1"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
