import { AuthHeader } from "@/components/layout/auth-header";

// Gabarit des pages d'authentification (connexion, inscription, mot de passe,
// vérification d'email) : en-tête, puis formulaire centré dans l'écran.

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {/* Pleine largeur : chaque carte garde la largeur maximale qui lui est propre. */}
        <div className="flex w-full flex-col items-center">{children}</div>
      </main>
    </div>
  );
}
