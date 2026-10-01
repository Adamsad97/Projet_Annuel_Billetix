import type { Metadata } from "next";
import { SHARED_OPEN_GRAPH, SITE_URL } from "@/lib/site-url";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { SessionManager } from "@/components/auth/session-manager";
import { AgentSpaceGuard } from "@/components/auth/agent-space-guard";
import { PreviewBanner } from "@/components/admin/preview-banner";

// Script synchrone avant le premier rendu pour éviter un flash sombre en mode clair.
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
  // Base des URL absolues (aperçus de partage, adresses canoniques).
  metadataBase: SITE_URL,
  title: "BilleTix — Votre prochain événement commence ici",
  description:
    "Concerts, festivals, spectacles près de chez vous. Paiement sécurisé et billet QR code reçu par email en 5 minutes.",
  openGraph: { ...SHARED_OPEN_GRAPH, url: "/" },
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
          <PreviewBanner />
          {children}
          <SessionManager />
          <AgentSpaceGuard />
        </ThemeProvider>
      </body>
    </html>
  );
}
