"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/components/event-detail/info-card";
import { CategoryPicker } from "@/components/create-event/category-picker";
import { PosterDropzone } from "@/components/create-event/poster-dropzone";
import {
  TicketTiersEditor,
  makeInitialTierRows,
  type TicketTierInitial,
  type TicketTierRow,
} from "@/components/create-event/ticket-tiers-editor";
import type { ApiCategory } from "@/lib/api/categories";
import type { ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import { createEvent, createTicketCategory, submitEventForValidation } from "@/lib/api/events";
import { createEventForOrganizer, createCategoryForOrganizer, submitEventForOrganizer } from "@/lib/api/admin";
import { uploadPoster } from "@/lib/api/upload";
import { ApiError } from "@/lib/api/http-error";

const fieldClassName =
  "rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none";

export interface CreateEventFormInitial {
  title: string;
  description: string;
  category: string;
  startAt: string;
  endAt: string;
  venueName: string;
  address: string;
  ticketTiers: TicketTierInitial[];
}

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const date = new Date(datetimeLocal);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function CreateEventForm({
  categories,
  tierTypes,
  initial,
  mode = "create",
  adminOrganizerId,
}: {
  categories: ApiCategory[];
  tierTypes: ApiTicketTierType[];
  initial?: CreateEventFormInitial;
  mode?: "create" | "edit";
  // CDC — accueil physique : un admin remplit ce même formulaire au nom
  // d'un organisateur venu au bureau. L'événement est créé sous le compte
  // de cet organisateur, pas celui de l'admin (cf. POST /admin/events).
  adminOrganizerId?: string;
}) {
  const router = useRouter();
  const genId = useId();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0]?.code ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [venueName, setVenueName] = useState(initial?.venueName ?? "");
  const [addressLine1, setAddressLine1] = useState(initial?.address ?? "");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");
  const [totalCapacity, setTotalCapacity] = useState("500");
  const [salesStartAt, setSalesStartAt] = useState("");
  const [salesEndAt, setSalesEndAt] = useState("");
  const [refundPolicy, setRefundPolicy] = useState<"NON_REFUNDABLE" | "REFUNDABLE">("NON_REFUNDABLE");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [tierRows, setTierRows] = useState<TicketTierRow[]>(() =>
    makeInitialTierRows(genId, tierTypes, initial?.ticketTiers),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // La page de modification (mode="edit") reste basée sur des données de
    // démonstration pour l'instant — câblage prévu avec le reste du flux
    // "gestion d'un événement" côté organisateur (pas encore attaqué).
    if (mode === "edit") {
      setError("La modification d'un événement existant n'est pas encore reliée au serveur.");
      return;
    }

    if (!posterFile) {
      setError("Choisis une affiche pour ton événement.");
      return;
    }
    const validTiers = tierRows.filter((row) => row.name.trim() && row.price && row.quota);
    if (validTiers.length === 0) {
      setError("Ajoute au moins une catégorie de billet complète (nom, prix, quota).");
      return;
    }
    const startIso = toIsoOrNull(startAt);
    const endIso = toIsoOrNull(endAt);
    const salesStartIso = toIsoOrNull(salesStartAt) ?? new Date().toISOString();
    const salesEndIso = toIsoOrNull(salesEndAt) ?? startIso;
    if (!startIso || !endIso || !salesEndIso) {
      setError("Vérifie les dates de l'événement et de la période de vente.");
      return;
    }

    setSubmitting(true);
    try {
      const { url: posterUrl } = await uploadPoster(posterFile);

      const eventDto = {
        title,
        description,
        category,
        start_date: startIso,
        end_date: endIso,
        venue_name: venueName,
        venue_address_line1: addressLine1,
        venue_city: city,
        venue_postal_code: postalCode,
        venue_country: country,
        poster_url: posterUrl,
        total_capacity: Number(totalCapacity),
        sales_start_date: salesStartIso,
        sales_end_date: salesEndIso,
        refund_policy: refundPolicy,
      };

      const createdEvent = adminOrganizerId
        ? await createEventForOrganizer(adminOrganizerId, eventDto)
        : await createEvent(eventDto);

      for (const row of validTiers) {
        const tierDto = {
          name: row.name,
          price_ht: Number(row.price),
          quota: Number(row.quota),
          max_per_order: row.maxPerOrder ? Number(row.maxPerOrder) : undefined,
        };
        if (adminOrganizerId) {
          await createCategoryForOrganizer(createdEvent.id, adminOrganizerId, tierDto);
        } else {
          await createTicketCategory(createdEvent.id, tierDto);
        }
      }

      if (adminOrganizerId) {
        await submitEventForOrganizer(createdEvent.id, adminOrganizerId);
        router.push(`/admin/validation/${createdEvent.id}`);
      } else {
        await submitEventForValidation(createdEvent.id);
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue, réessaie.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <InfoCard icon="📋" title="Informations générales">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Titre *
            </span>
            <input
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex : Nuit Électronique — La Défense Arena"
              className={fieldClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Description *
            </span>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Décrivez votre événement en détail…"
              className={`${fieldClassName} resize-none`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Catégorie *
            </span>
            <CategoryPicker categories={categories} value={category} onChange={setCategory} />
          </div>
        </div>
      </InfoCard>

      <InfoCard icon="📅" title="Date & lieu">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">
                Date de début *
              </span>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">
                Date de fin *
              </span>
              <input
                type="datetime-local"
                required
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Nom du lieu *
            </span>
            <input
              type="text"
              required
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              placeholder="La Défense Arena"
              className={fieldClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              Adresse *
            </span>
            <input
              type="text"
              required
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              placeholder="2 Esplanade de la Défense"
              className={fieldClassName}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Ville *</span>
              <input
                type="text"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Puteaux"
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Code postal *</span>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder="92000"
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Pays *</span>
              <input
                type="text"
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>
        </div>
      </InfoCard>

      <InfoCard icon="🖼️" title="Affiche de l'événement">
        <PosterDropzone onFileSelected={setPosterFile} />
      </InfoCard>

      <InfoCard icon="🎟️" title="Billetterie">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Capacité totale *</span>
              <input
                type="number"
                required
                min={1}
                value={totalCapacity}
                onChange={(event) => setTotalCapacity(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Politique de remboursement *</span>
              <select
                value={refundPolicy}
                onChange={(event) => setRefundPolicy(event.target.value as "NON_REFUNDABLE" | "REFUNDABLE")}
                className={fieldClassName}
              >
                <option value="NON_REFUNDABLE" className="bg-[#12101c]">Non remboursable</option>
                <option value="REFUNDABLE" className="bg-[#12101c]">Remboursable</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Ouverture des ventes</span>
              <input
                type="datetime-local"
                value={salesStartAt}
                onChange={(event) => setSalesStartAt(event.target.value)}
                className={fieldClassName}
              />
              <span className="text-xs text-gray-500">Laisser vide pour ouvrir dès la validation.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-violet-200/80">Fermeture des ventes</span>
              <input
                type="datetime-local"
                value={salesEndAt}
                onChange={(event) => setSalesEndAt(event.target.value)}
                className={fieldClassName}
              />
              <span className="text-xs text-gray-500">Laisser vide pour fermer au début de l&apos;événement.</span>
            </label>
          </div>
        </div>
      </InfoCard>

      <InfoCard icon="✏️" title="Catégories de billets">
        <TicketTiersEditor rows={tierRows} onChange={setTierRows} tierTypes={tierTypes} />
      </InfoCard>

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Envoi en cours…"
          : mode === "edit"
            ? "Enregistrer les modifications →"
            : adminOrganizerId
              ? "Créer pour cet organisateur →"
              : "Soumettre à la validation →"}
      </button>

      {adminOrganizerId ? (
        <p className="text-center text-xs text-gray-500">
          L&apos;événement sera créé sous le compte de l&apos;organisateur puis soumis à validation — tu seras redirigé vers sa fiche pour la traiter.
        </p>
      ) : mode === "create" ? (
        <p className="text-center text-xs text-gray-500">
          ⏱️ Délai de traitement : 48h ouvrées maximum
        </p>
      ) : (
        <p className="text-center text-xs text-gray-500">
          ⏱️ Toute modification substantielle repasse en validation (48h ouvrées).
        </p>
      )}
    </form>
  );
}
