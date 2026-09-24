"use client";

// Bug corrigé : /evenements/:id/modifier était 100% maquette et le
// formulaire de création bloquait explicitement le mode édition
// ("pas encore reliée au serveur"). Formulaire dédié plutôt que de
// surcharger CreateEventForm : les champs réellement modifiables changent
// selon le statut (cf. lib/api/events.ts EVENT_COSMETIC_FIELDS), une
// logique assez différente de la création pour justifier un composant à
// part plutôt que d'entremêler les deux flux.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/components/event-detail/info-card";
import { CategoryPicker } from "@/components/create-event/category-picker";
import { PosterDropzone } from "@/components/create-event/poster-dropzone";
import type { ApiCategory } from "@/lib/api/categories";
import { updateEvent, type ApiEvent, type UpdateEventDto } from "@/lib/api/events";
import { uploadPoster } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/http-error";

const fieldClassName =
  "rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const date = new Date(datetimeLocal);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const LOCKED_STATUS_MESSAGE: Partial<Record<ApiEvent["status"], string>> = {
  SUSPENDED: "Cet événement est suspendu par l'administration — plus aucune modification n'est possible.",
  CANCELLED: "Cet événement est annulé — plus aucune modification n'est possible.",
  TERMINATED: "Cet événement est terminé — plus aucune modification n'est possible.",
  ARCHIVED: "Cet événement est archivé — plus aucune modification n'est possible.",
};

export function EditEventForm({
  event: initialEvent,
  categories,
}: {
  event: ApiEvent;
  categories: ApiCategory[];
}) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const isDraft = event.status === "DRAFT";
  const isFullyLocked = event.status in LOCKED_STATUS_MESSAGE;
  // PENDING_VALIDATION/PUBLISHED : seuls les champs "cosmétiques" restent
  // ouverts (cf. commentaire lib/api/events.ts) — DRAFT autorise tout sauf
  // les catégories de billets, jamais modifiables une fois créées.

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [category, setCategory] = useState(event.category);
  const [startAt, setStartAt] = useState(toDatetimeLocal(event.start_date));
  const [endAt, setEndAt] = useState(toDatetimeLocal(event.end_date));
  const [venueName, setVenueName] = useState(event.venue_name);
  const [addressLine1, setAddressLine1] = useState(event.venue_address_line1);
  const [city, setCity] = useState(event.venue_city);
  const [postalCode, setPostalCode] = useState(event.venue_postal_code);
  const [country, setCountry] = useState(event.venue_country);
  const [totalCapacity, setTotalCapacity] = useState(String(event.total_capacity));
  const [salesStartAt, setSalesStartAt] = useState(toDatetimeLocal(event.sales_start_date));
  const [salesEndAt, setSalesEndAt] = useState(toDatetimeLocal(event.sales_end_date));
  const [refundPolicy, setRefundPolicy] = useState(event.refund_policy);
  const [accessConditions, setAccessConditions] = useState(event.access_conditions ?? "");
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Déclenché directement par le clic du bouton plutôt que par la
  // soumission native du <form> — un select/textarea imbriqué peut bloquer
  // silencieusement submit() dans certains navigateurs sans qu'aucune
  // erreur ne remonte nulle part (observé : clic sans le moindre effet,
  // aucune requête réseau émise).
  async function handleSubmit() {
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      let posterUrl: string | undefined;
      if (posterFile) {
        const result = await uploadPoster(posterFile);
        posterUrl = result.url;
      }

      const dto: UpdateEventDto = isDraft
        ? {
            title,
            description,
            category,
            start_date: toIsoOrNull(startAt) ?? event.start_date,
            end_date: toIsoOrNull(endAt) ?? event.end_date,
            venue_name: venueName,
            venue_address_line1: addressLine1,
            venue_city: city,
            venue_postal_code: postalCode,
            venue_country: country,
            total_capacity: Number(totalCapacity),
            sales_start_date: toIsoOrNull(salesStartAt) ?? event.sales_start_date,
            sales_end_date: toIsoOrNull(salesEndAt) ?? event.sales_end_date,
            refund_policy: refundPolicy,
            ...(posterUrl ? { poster_url: posterUrl } : {}),
          }
        : {
            description,
            access_conditions: accessConditions || undefined,
            ...(posterUrl ? { poster_url: posterUrl } : {}),
          };

      const updated = await updateEvent(event.id, dto);
      setEvent(updated);
      setPosterFile(null);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // Garde une trace exploitable dans la console même si la bannière
      // d'erreur passe inaperçue (ex: hors du viewport au moment du clic).
      console.error("[EditEventForm] échec de l'enregistrement :", err);
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer les modifications.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  if (isFullyLocked) {
    return (
      <InfoCard icon="🔒" title="Modification impossible">
        <p className="text-sm text-gray-400">{LOCKED_STATUS_MESSAGE[event.status]}</p>
      </InfoCard>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {!isDraft ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-amber-200">
          Cet événement est {event.status === "PUBLISHED" ? "publié" : "en attente de validation"} — seuls
          la description, l&apos;affiche et les conditions d&apos;accès restent modifiables, pour ne pas
          changer les informations sur lesquelles les acheteurs se sont déjà engagés.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">{error}</div>
      ) : null}
      {saved ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-300">
          ✓ Modifications enregistrées.
        </div>
      ) : null}

      <InfoCard icon="📝" title="Informations générales">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isDraft}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Description</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${fieldClassName} resize-none`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Catégorie</span>
            {isDraft ? (
              <CategoryPicker categories={categories} value={category} onChange={setCategory} />
            ) : (
              <input value={categories.find((c) => c.code === category)?.label ?? category} disabled className={fieldClassName} />
            )}
          </label>
        </div>
      </InfoCard>

      <InfoCard icon="🖼️" title="Affiche">
        <PosterDropzone onFileSelected={setPosterFile} initialPreviewUrl={event.poster_url} />
      </InfoCard>

      <InfoCard icon="📅" title="Dates">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Début</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Fin</span>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Début des ventes</span>
            <input type="datetime-local" value={salesStartAt} onChange={(e) => setSalesStartAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Fin des ventes</span>
            <input type="datetime-local" value={salesEndAt} onChange={(e) => setSalesEndAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
        </div>
      </InfoCard>

      <InfoCard icon="📍" title="Lieu">
        <div className="flex flex-col gap-4">
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} disabled={!isDraft} placeholder="Nom du lieu" className={fieldClassName} />
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} disabled={!isDraft} placeholder="Adresse" className={fieldClassName} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input value={city} onChange={(e) => setCity(e.target.value)} disabled={!isDraft} placeholder="Ville" className={fieldClassName} />
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={!isDraft} placeholder="Code postal" className={fieldClassName} />
            <input value={country} onChange={(e) => setCountry(e.target.value)} disabled={!isDraft} placeholder="Pays" className={fieldClassName} />
          </div>
        </div>
      </InfoCard>

      <InfoCard icon="🎟️" title="Capacité, remboursement et accès">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Capacité totale</span>
            <input
              type="number"
              min="1"
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
              disabled={!isDraft}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Politique de remboursement</span>
            <select
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value as "NON_REFUNDABLE" | "REFUNDABLE")}
              disabled={!isDraft}
              className={fieldClassName}
            >
              <option value="NON_REFUNDABLE" className="bg-[#12101c]">Non remboursable</option>
              <option value="REFUNDABLE" className="bg-[#12101c]">Remboursable</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">Conditions d&apos;accès</span>
            <textarea
              rows={3}
              value={accessConditions}
              onChange={(e) => setAccessConditions(e.target.value)}
              placeholder="Ex : pièce d'identité obligatoire, interdit aux moins de 16 ans…"
              className={`${fieldClassName} resize-none`}
            />
          </label>
        </div>
      </InfoCard>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/evenements/${event.id}`)}
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </div>
  );
}
