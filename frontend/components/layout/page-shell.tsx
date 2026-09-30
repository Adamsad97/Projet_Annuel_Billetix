import { AuthHeader } from "@/components/layout/auth-header";

// Gabarit des pages de l'espace connecté : en-tête, puis contenu centré
// dans une colonne dont la largeur dépend de la page.

const WIDTHS = {
  md: "max-w-md",
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-7xl",
} as const;

export function PageShell({
  width,
  className = "",
  children,
}: {
  width: keyof typeof WIDTHS;
  /** Classes ajoutées à la colonne de contenu. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />
      <main className={`mx-auto w-full ${WIDTHS[width]} flex-1 px-6 py-10 ${className}`.trim()}>{children}</main>
    </div>
  );
}
