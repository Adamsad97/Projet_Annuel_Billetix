import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { SessionManager } from "@/components/auth/session-manager";

// Bug corrigé : sans ce script exécuté avant tout rendu, un visiteur ayant
// choisi le mode clair verrait un flash sombre (thème par défaut) au
// chargement de chaque page, le temps que React s'hydrate côté client.
// Volontairement en JS inline classique (pas de useEffect) : doit tourner
// de façon synchrone, avant le premier paint.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("billetix-theme");if(t==="light"||(!t&&window.matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.setAttribute("data-theme","light");}}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BilletiX — Votre prochain événement commence ici",
  description:
    "Des milliers d'événements. Billets QR code à usage unique envoyés en 5 minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <SessionManager />
        </ThemeProvider>
      </body>
    </html>
  );
}
