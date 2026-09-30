"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { OrganizerProfileForm } from "@/components/dashboard/organizer-profile-form";
import { getOrganizerProfile, type ApiOrganizerProfile } from "@/lib/api/organizer-profile";
import { ApiError } from "@/lib/api/http-error";
import { BackLink } from "@/components/ui/back-link";

/** Profil public de l'organisateur : création au premier passage, puis modification. */
export default function OrganizerProfilePage() {
  // undefined : chargement ; null : pas encore de profil.
  const [profile, setProfile] = useState<ApiOrganizerProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrganizerProfile()
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setProfile(null);
        else setError(err instanceof ApiError ? err.message : "Impossible de charger votre profil organisateur.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell width="2xl">
      <BackLink href="/dashboard">Tableau de bord</BackLink>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Profil organisateur</h1>
        <p className="mt-1 text-sm text-ink-5">
          {profile === null
            ? "Présentez-vous avant de publier vos événements : ces informations sont visibles par le public."
            : "Ces informations présentent votre structure au public."}
        </p>
      </div>

      {justCreated ? (
        <div role="status" className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
          <p className="text-sm font-semibold text-ink-1">Votre profil organisateur est créé.</p>
          <p className="mt-1 text-sm text-ink-3">
            Étape suivante : fournissez votre pièce d&apos;identité pour recevoir les reversements de vos ventes.
          </p>
          <Link
            href="/dashboard/paiements"
            className="mt-3 inline-flex rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Configurer les paiements →
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-danger">{error}</p>
      ) : profile === undefined ? (
        <p className="text-sm text-ink-5">Chargement…</p>
      ) : (
        <OrganizerProfileForm
          // Nouvelle instance après création : le formulaire passe en modification.
          key={profile?.id ?? "new"}
          profile={profile}
          onSaved={(saved) => {
            if (profile === null) setJustCreated(true);
            setProfile(saved);
          }}
        />
      )}
    </PageShell>
  );
}
