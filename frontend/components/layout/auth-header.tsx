"use client";

// Bug corrigé : ce header des espaces connectés (dashboard/profil/admin)
// n'affichait ni le nom de l'utilisateur ni aucun moyen de se déconnecter.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/auth/logout";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/layout/logo";
import { PreviewSwitcher } from "@/components/admin/preview-switcher";
import { isAdminRole, isPreviewActive } from "@/lib/auth/preview";

export function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  // Révoque aussi la session côté serveur (cf. lib/auth/logout.ts).
  async function handleLogout() {
    await logout();
    setUser(null);
    router.push("/");
  }

  // Le logo mène à l'accueil pour tous les rôles (le back-office reste
  // accessible par le lien « Back-office » de la barre de navigation).
  const homeHref = "/";

  return (
    <header className="border-b border-hairline-2 bg-header/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href={homeHref}>
          <Logo />
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAdminRole(user?.role) && !isPreviewActive() ? (
            <span className="hidden md:inline-flex">
              <PreviewSwitcher />
            </span>
          ) : null}
          {user === undefined ? null : user ? (
            <>
              <span className="hidden text-sm font-medium text-ink-3 sm:block">
                {user.first_name} {user.last_name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link
              href="/connexion"
              className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
            >
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
