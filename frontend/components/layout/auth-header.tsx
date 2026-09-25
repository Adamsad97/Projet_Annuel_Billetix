"use client";

// Bug corrigé : ce header des espaces connectés (dashboard/profil/admin)
// n'affichait ni le nom de l'utilisateur ni aucun moyen de se déconnecter.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";

export function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
  }, []);

  function handleLogout() {
    clearSession();
    setUser(null);
    router.push("/");
  }

  // Bug corrigé : le logo pointait vers "/" pour tout le monde, y compris
  // dans le back-office. Pour un ADMIN/SUPER_ADMIN, "/" rebondit maintenant
  // aussitôt vers "/admin" (BuyerOnlyGate) — le clic semblait ne rien faire.
  // Le logo redevient "/admin" pour eux, "/" pour les autres rôles.
  const homeHref =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin" : "/";

  return (
    <header className="border-b border-white/10 bg-[#0a0812]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href={homeHref}
          className="bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
        >
          BilleTiX
        </Link>

        {user === undefined ? null : user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-gray-300 sm:block">
              {user.first_name} {user.last_name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <Link
            href="/connexion"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
          >
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}
