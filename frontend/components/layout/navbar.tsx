"use client";

// Bug corrigé : ce composant affichait toujours "Connexion"/"S'inscrire",
// même une fois connecté — il ne lisait jamais la session réelle. La lecture
// se fait ici en useEffect (après montage) plutôt qu'en initialiseur de
// useState, pour que le premier rendu client corresponde au HTML serveur
// (évite un hydration mismatch, même pattern que checkout-flow.tsx).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getStoredUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/api/auth";

const navLinks = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/revente", label: "Revente" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profil", label: "Profil" },
  { href: "/admin", label: "Admin" },
];

export function Navbar({ active = "/catalogue" }: { active?: string }) {
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

  const visibleLinks = navLinks.filter((link) => {
    if (link.href === "/admin") return user?.role === "ADMIN";
    if (link.href === "/dashboard") return user?.role === "ORGANIZER" || user?.role === "ADMIN";
    return true;
  });

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0812]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
        >
          BilleTiX
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map((link) => {
            const isActive = link.href === active;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isActive
                    ? "rounded-full bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-200 ring-1 ring-inset ring-violet-500/40"
                    : "rounded-full px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user === undefined ? null : user ? (
            <>
              <Link
                href="/profil"
                className="hidden text-sm font-medium text-gray-300 hover:text-white sm:block"
              >
                {user.first_name}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
              >
                Connexion
              </Link>
              <Link
                href="/inscription"
                className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
