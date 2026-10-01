"use client";

// Mode clair/sombre : le script du <head> pose data-theme avant hydratation, ce provider synchronise l'état et le bouton.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { t } from "@/lib/i18n/translate";

export type Theme = "light" | "dark";

const STORAGE_KEY = "billetix-theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
} | null>(null);

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    // Sans attribut, thème sombre par défaut : un échec du script retombe sur l'apparence normale.
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lu depuis le DOM (déjà posé par le script bloquant), pas recalculé ici
  // — évite tout écart entre le rendu serveur et l'état initial client.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée…) — le choix ne survit
      // pas au rechargement, tant pis, pas bloquant.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error(t("useTheme() doit être utilisé sous ThemeProvider"));
  return ctx;
}
