"use client";

// Bug corrigé : ce composant affichait toujours "Connexion"/"S'inscrire",
// même une fois connecté — il ne lisait jamais la session réelle. La lecture
// se fait ici en useEffect (après montage) plutôt qu'en initialiseur de
// useState, pour que le premier rendu client corresponde au HTML serveur
// (évite un hydration mismatch, même pattern que checkout-flow.tsx).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/lib/auth/logout";
import { getStoredUser } from "@/lib/auth/session";
import type { AuthUser, UserRole } from "@/lib/api/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "@/components/layout/logo";
import { PreviewSwitcher } from "@/components/admin/preview-switcher";
import { effectiveRole, isAdminRole, isPreviewActive, PREVIEW_CHANGED_EVENT } from "@/lib/auth/preview";

// Matrice de rôles de la navbar — un compte n'a qu'un seul rôle à la fois,
// chaque onglet ne sert donc qu'à celui à qui il est réellement utile
// (ex: ADMIN n'achète ni ne scanne jamais et n'a pas le catalogue — il peut
// en revanche prévisualiser chaque rôle, cf. lib/auth/preview.ts —,
// ORGANIZER ne parcourt pas le catalogue comme un acheteur). `allowGuest` : visible sans être connecté
// (vitrine publique) ; `roles` s'applique seulement une fois connecté.
const navLinks: Array<{ href: string; label: string; allowGuest?: boolean; roles: UserRole[] }> = [
  { href: "/catalogue", label: "Catalogue", allowGuest: true, roles: ["BUYER"] },
  // Revente réservée aux acheteurs connectés : plus visible des visiteurs.
  { href: "/revente", label: "Revente", roles: ["BUYER"] },
  { href: "/profil/billets", label: "Mes billets", roles: ["BUYER"] },
  { href: "/dashboard", label: "Dashboard", roles: ["ORGANIZER"] },
  // ORGANIZER scanne ses propres événements (vérifié côté gateway via
  // event.get), AGENT c'est son seul métier sur la plateforme.
  { href: "/scan", label: "Scan", roles: ["ORGANIZER", "AGENT"] },
  { href: "/profil", label: "Profil", roles: ["BUYER", "ORGANIZER", "AGENT", "ADMIN", "SUPER_ADMIN"] },
  { href: "/admin", label: "Back-office", roles: ["ADMIN", "SUPER_ADMIN"] },
];

export function Navbar({ active = "/catalogue" }: { active?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  // Rendu recalculé quand l'admin entre ou sort du mode aperçu.
  const [, setPreviewVersion] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getStoredUser());
    const onPreview = () => setPreviewVersion((version) => version + 1);
    window.addEventListener(PREVIEW_CHANGED_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_CHANGED_EVENT, onPreview);
  }, []);

  // Révoque aussi la session côté serveur (cf. lib/auth/logout.ts).
  async function handleLogout() {
    await logout();
    setUser(null);
    router.push("/");
  }

  // Rôle affiché : celui prévisualisé par un admin, sinon le vrai.
  const role = effectiveRole(user);
  const isRealAdmin = isAdminRole(user?.role);
  const visibleLinks = navLinks.filter((link) =>
    user && role ? link.roles.includes(role) : (link.allowGuest ?? false),
  );

  return (
    <header className="sticky top-0 z-50 border-b border-hairline-2 bg-header/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href={user?.role === "AGENT" ? "/scan" : "/"} className="shrink-0">
          <Logo />
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
                    ? "rounded-full bg-blue-600/20 px-4 py-2 text-sm font-medium text-accent ring-1 ring-inset ring-blue-500/40"
                    : "rounded-full px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:text-ink-1"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {isRealAdmin && !isPreviewActive() ? (
            <span className="hidden lg:inline-flex">
              <PreviewSwitcher />
            </span>
          ) : null}
          {user === undefined ? null : user ? (
            <>
              {/* Masqué pour ADMIN/SUPER_ADMIN : le lien "Back-office" du
                  menu suffit déjà, et le prénom du compte de bootstrap
                  ("Admin BilletiX") créait un doublon visuel confus. */}
              {user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" ? (
                <Link
                  href="/profil"
                  className="hidden text-sm font-medium text-ink-3 hover:text-ink-1 sm:block"
                >
                  {user.first_name}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap rounded-full border border-hairline-3 px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 sm:px-4"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="whitespace-nowrap rounded-full border border-hairline-3 px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 sm:px-4"
              >
                Connexion
              </Link>
              <Link
                href="/inscription"
                className="whitespace-nowrap rounded-full bg-blue-700 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 sm:px-4"
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
