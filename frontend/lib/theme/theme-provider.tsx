"use client";

// Mode clair/sombre — cf. globals.css pour les tokens de couleur. Le script
// bloquant dans <head> (app/layout.tsx) pose déjà `data-theme="light"` sur
// <html> avant l'hydratation si nécessaire (évite le flash sombre→clair au
// chargement) — ce provider ne fait que synchroniser l'état React dessus et
// gérer le bouton de bascule.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
    // Pas d'attribut = sombre (valeur par défaut des tokens dans
    // globals.css) — garantit qu'un échec du script d'initialisation
    // retombe toujours sur l'apparence actuelle de l'appli, jamais cassée.
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
  if (!ctx) throw new Error("useTheme() doit être utilisé sous ThemeProvider");
  return ctx;
}
