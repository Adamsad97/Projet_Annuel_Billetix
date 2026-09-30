"use client";

import { PageShell } from "@/components/layout/page-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { OrganizerProfileForm } from "@/components/dashboard/organizer-profile-form";
import { BackLink } from "@/components/ui/back-link";
import { cardClass } from "@/components/ui/card";

const STEPS = [
  { title: "Votre profil", text: "Nom public, présentation et logo de votre structure." },
  { title: "Vos événements", text: "Créez-les depuis votre tableau de bord ; notre équipe les valide avant publication." },
  { title: "Vos reversements", text: "Pièce d'identité et coordonnées bancaires pour recevoir le produit de vos ventes." },
];

/** Un acheteur passe organisateur en créant son profil (bascule de rôle immédiate). */
export default function BecomeOrganizerPage() {
  return (
    <RequireAuth roles={["BUYER"]}>
      <PageShell width="2xl">
        <BackLink href="/profil">Mon profil</BackLink>

        <h1 className="text-2xl font-bold text-ink-1">Devenir organisateur</h1>
        <p className="mt-1 text-sm text-ink-5">
          Vendez vos billets sur BilleTix. Votre compte acheteur est conservé : vos billets et commandes restent
          accessibles.
        </p>

        <ol className="my-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className={cardClass("p-4")}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-1">{step.title}</p>
              <p className="mt-1 text-xs text-ink-5">{step.text}</p>
            </li>
          ))}
        </ol>

        <OrganizerProfileForm
          profile={null}
          submitLabel="Devenir organisateur"
          // Rechargement complet : l'en-tête et les gardes relisent le nouveau rôle.
          onSaved={() => window.location.assign("/dashboard/paiements")}
        />
      </PageShell>
    </RequireAuth>
  );
}
