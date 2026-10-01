"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/components/event-detail/info-card";
import { CategoryPicker } from "@/components/create-event/category-picker";
import { VatRateSelect } from "@/components/create-event/vat-rate-select";
import { listVatRates, type ApiVatRate } from "@/lib/api/vat-rates";
import { TicketingTypeToggle } from "@/components/create-event/ticketing-type-toggle";
import { CoverDropzone } from "@/components/create-event/cover-dropzone";
import { PosterDropzone } from "@/components/create-event/poster-dropzone";
import { LocationPicker } from "@/components/map/location-picker";
import { AddressAutocomplete } from "@/components/create-event/address-autocomplete";
import {
  TicketTiersEditor,
  makeInitialTierRows,
  type TicketTierInitial,
  type TicketTierRow,
} from "@/components/create-event/ticket-tiers-editor";
import type { ApiCategory } from "@/lib/api/categories";
import type { ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import {
  createEvent,
  createTicketCategory,
  getPricingPolicy,
  submitEventForValidation,
  type PricingPolicy,
} from "@/lib/api/events";
import { createEventForOrganizer, createCategoryForOrganizer, submitEventForOrganizer } from "@/lib/api/admin";
import { uploadDocument, uploadPoster } from "@/lib/api/upload";
import { DocumentDropzone } from "@/components/ui/document-dropzone";
import { ApiError } from "@/lib/api/http-error";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

const fieldClassName = fieldClass("px-4 py-3");

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

// Pas de date passée : min au format datetime-local (« AAAA-MM-JJThh:mm », heure locale).
function nowAsDatetimeLocal(): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  // Accueil physique : un admin crée l'événement au nom d'un organisateur venu au bureau.
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [totalCapacity, setTotalCapacity] = useState("500");
  // Taux (TVA, commission, frais) pour le détail des prix pendant la saisie.
  const [pricing, setPricing] = useState<PricingPolicy | null>(null);
  // Taux de TVA proposés par l'admin ; le taux par défaut est présélectionné.
  const [vatRates, setVatRates] = useState<ApiVatRate[]>([]);
  const [vatRateId, setVatRateId] = useState("");
  useEffect(() => {
    getPricingPolicy()
      .then(setPricing)
      .catch(() => setPricing(null));
    listVatRates()
      .then((list) => {
        setVatRates(list);
        setVatRateId((current) => current || (list.find((rate) => rate.is_default) ?? list[0])?.id || "");
      })
      .catch(() => setVatRates([]));
  }, []);
  const selectedVat = vatRates.find((rate) => rate.id === vatRateId);
  // Aperçu des prix avec le taux choisi.
  const pricingForEvent = pricing && selectedVat ? { ...pricing, tva_rate: Number(selectedVat.rate) } : null;
  const [salesStartAt, setSalesStartAt] = useState("");
  const [salesEndAt, setSalesEndAt] = useState("");
  const [refundPolicy, setRefundPolicy] = useState<"NON_REFUNDABLE" | "REFUNDABLE">("NON_REFUNDABLE");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isNonProfit, setIsNonProfit] = useState(false);
  // Événement gratuit : toutes les catégories à 0 €.
  const [isFree, setIsFree] = useState(false);

  /** Bascule payant / gratuit : 0 € partout, ou prix à saisir de nouveau. */
  function applyFree(free: boolean) {
    setIsFree(free);
    setTierRows((rows) => rows.map((row) => ({ ...row, price: free ? "0" : "" })));
  }
  const [nonProfitFile, setNonProfitFile] = useState<File | null>(null);
  const [tierRows, setTierRows] = useState<TicketTierRow[]>(() =>
    makeInitialTierRows(genId, tierTypes, initial?.ticketTiers),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minDatetimeLocal = nowAsDatetimeLocal();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Mode « edit » non géré ici : la modification passe par EditEventForm.
    if (mode === "edit") {
      setError(t("La modification d'un événement existant n'est pas encore reliée au serveur."));
      return;
    }

    if (!posterFile) {
      setError(t("Choisissez une affiche pour votre événement."));
      return;
    }
    if (isNonProfit && !nonProfitFile) {
      setError(t("Joignez un justificatif pour la déclaration à but non lucratif."));
      return;
    }
    const validTiers = tierRows.filter((row) => row.name.trim() && row.price && row.quota);
    if (validTiers.length === 0) {
      setError(
        isFree
          ? t("Ajoutez au moins une catégorie de billet complète (nom, quota).")
          : t("Ajoutez au moins une catégorie de billet complète (nom, prix, quota)."),
      );
      return;
    }
    const totalQuota = validTiers.reduce((sum, row) => sum + Number(row.quota), 0);
    if (totalQuota > Number(totalCapacity)) {
      setError(
        t("La somme des quotas ({totalQuota}) dépasse la capacité totale ({totalCapacity}) — ajustez les catégories de billets ou la capacité.", { totalQuota, totalCapacity }),
      );
      return;
    }
    const startIso = toIsoOrNull(startAt);
    const endIso = toIsoOrNull(endAt);
    const salesStartIso = toIsoOrNull(salesStartAt) ?? new Date().toISOString();
    const salesEndIso = toIsoOrNull(salesEndAt) ?? startIso;
    if (!startIso || !endIso || !salesEndIso) {
      setError(t("Vérifiez les dates de l'événement et de la période de vente."));
      return;
    }
    if (new Date(startIso).getTime() < Date.now()) {
      setError(t("La date de début ne peut pas être dans le passé."));
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError(t("La date de fin doit être postérieure à la date de début."));
      return;
    }

    setSubmitting(true);
    try {
      const { url: posterUrl } = await uploadPoster(posterFile);
      const coverUrl = coverFile ? (await uploadPoster(coverFile)).url : undefined;
      const nonProfitDocumentUrl =
        isNonProfit && nonProfitFile ? (await uploadDocument(nonProfitFile)).url : undefined;

      const eventDto = {
        title,
        description,
        category,
        ...(vatRateId ? { vat_rate_id: vatRateId } : {}),
        start_date: startIso,
        end_date: endIso,
        venue_name: venueName,
        venue_address_line1: addressLine1,
        venue_city: city,
        venue_postal_code: postalCode,
        venue_country: country,
        ...(latitude !== null && longitude !== null
          ? { venue_latitude: latitude, venue_longitude: longitude }
          : {}),
        poster_url: posterUrl,
        ...(coverUrl ? { cover_url: coverUrl } : {}),
        total_capacity: Number(totalCapacity),
        sales_start_date: salesStartIso,
        sales_end_date: salesEndIso,
        // Rien à rembourser sur une entrée gratuite.
        refund_policy: isFree ? "NON_REFUNDABLE" : refundPolicy,
        ...(nonProfitDocumentUrl ? { is_non_profit: true, non_profit_document_url: nonProfitDocumentUrl } : {}),
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
      setError(err instanceof ApiError ? err.message : t("Une erreur est survenue, veuillez réessayer."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <InfoCard icon="📋" title={t("Informations générales")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Titre *")}</span>
            <input
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("Ex : Nuit Électronique — La Défense Arena")}
              className={fieldClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Description *")}</span>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("Décrivez votre événement en détail…")}
              className={`${fieldClassName} resize-none`}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Catégorie *")}</span>
            <CategoryPicker categories={categories} value={category} onChange={setCategory} />
          </div>

          {vatRates.length > 0 ? <VatRateSelect vatRates={vatRates} value={vatRateId} onChange={setVatRateId} /> : null}
        </div>
      </InfoCard>

      <InfoCard icon="📅" title={t("Date & lieu")}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Date de début *")}</span>
              <input
                type="datetime-local"
                required
                min={minDatetimeLocal}
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Date de fin *")}</span>
              <input
                type="datetime-local"
                required
                min={startAt || minDatetimeLocal}
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Nom du lieu *")}</span>
            <input
              type="text"
              required
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              placeholder={t("La Défense Arena")}
              className={fieldClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Adresse *")}</span>
            <AddressAutocomplete
              value={addressLine1}
              onChangeText={setAddressLine1}
              country={country}
              onSelect={(suggestion) => {
                setAddressLine1(suggestion.addressLine1);
                if (suggestion.city) setCity(suggestion.city);
                if (suggestion.postalCode) setPostalCode(suggestion.postalCode);
                if (suggestion.country) setCountry(suggestion.country);
                setLatitude(suggestion.lat);
                setLongitude(suggestion.lng);
              }}
              placeholder={t("2 Esplanade de la Défense")}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Ville *")}</span>
              <input
                type="text"
                required
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={t("Puteaux")}
                className={fieldClassName}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Code postal *")}</span>
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
              <span className="text-sm font-medium text-accent/80">{t("Pays *")}</span>
              <input
                type="text"
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={fieldClassName}
              />
            </label>
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      </InfoCard>

      <InfoCard icon="🖼️" title={t("Affiche de l'événement")}>
        <PosterDropzone onFileSelected={setPosterFile} />
      </InfoCard>

      <InfoCard icon="🌄" title={t("Image de couverture (facultatif)")}>
        <CoverDropzone onFileSelected={setCoverFile} onRemove={() => setCoverFile(null)} />
      </InfoCard>

      {/* Dépôt du justificatif réservé à l'organisateur lui-même, absent quand un admin crée pour lui. */}
      {!adminOrganizerId ? (
        <InfoCard icon="🤝" title={t("Événement à but non lucratif")}>
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isNonProfit}
                onChange={(event) => {
                  const nonProfit = event.target.checked;
                  setIsNonProfit(nonProfit);
                  // Un événement à but non lucratif est proposé en gratuit par
                  // défaut — « Payant » reste possible (gala caritatif…).
                  if (nonProfit !== isFree) applyFree(nonProfit);
                }}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-ink-3">{t("Cet événement est organisé à but non lucratif (association, action caritative…). Après vérification du justificatif par un administrateur, la commission de la plateforme ne s'applique pas.")}</span>
            </label>
            {isNonProfit ? (
              <p className="text-xs text-ink-5">
                {isFree
                  ? t("Billetterie passée en « Gratuit ». Si vous vendez des billets (gala caritatif…), cochez « Payant » dans la section Billetterie.")
                  : t("Billetterie payante : la commission de la plateforme ne s'appliquera pas après vérification du justificatif.")}
              </p>
            ) : null}
            {isNonProfit ? (
              <DocumentDropzone
                onFileSelected={setNonProfitFile}
                disabled={submitting}
                hint={t("Glissez le justificatif (statuts, récépissé de déclaration…) ou cliquez")}
              />
            ) : null}
          </div>
        </InfoCard>
      ) : null}

      <InfoCard icon="🎟️" title={t("Billetterie")}>
        <div className="flex flex-col gap-4">
          <TicketingTypeToggle free={isFree} onChange={applyFree} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Capacité totale *")}</span>
              <input
                type="number"
                required
                min={1}
                value={totalCapacity}
                onChange={(event) => setTotalCapacity(event.target.value)}
                className={fieldClassName}
              />
            </label>
            {isFree ? null : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Politique de remboursement *")}</span>
              <select
                value={refundPolicy}
                onChange={(event) => setRefundPolicy(event.target.value as "NON_REFUNDABLE" | "REFUNDABLE")}
                className={fieldClassName}
              >
                <option value="NON_REFUNDABLE" className="bg-card">{t("Non remboursable")}</option>
                <option value="REFUNDABLE" className="bg-card">{t("Remboursable")}</option>
              </select>
            </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Ouverture des ventes")}</span>
              <input
                type="datetime-local"
                min={minDatetimeLocal}
                value={salesStartAt}
                onChange={(event) => setSalesStartAt(event.target.value)}
                className={fieldClassName}
              />
              <span className="text-xs text-ink-5">{t("Laisser vide pour ouvrir dès la validation.")}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-accent/80">{t("Fermeture des ventes")}</span>
              <input
                type="datetime-local"
                min={salesStartAt || minDatetimeLocal}
                value={salesEndAt}
                onChange={(event) => setSalesEndAt(event.target.value)}
                className={fieldClassName}
              />
              <span className="text-xs text-ink-5">{t("Laisser vide pour fermer au début de l'événement.")}</span>
            </label>
          </div>
        </div>
      </InfoCard>

      <InfoCard icon="✏️" title={t("Catégories de billets")}>
        <TicketTiersEditor
          rows={tierRows}
          onChange={setTierRows}
          tierTypes={tierTypes}
          totalCapacity={Number(totalCapacity) || 0}
          pricing={pricingForEvent}
          free={isFree}
        />
      </InfoCard>

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={buttonClass("primary", "w-full rounded-full py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50")}
      >
        {submitting
          ? t("Envoi en cours…")
          : mode === "edit"
            ? t("Enregistrer les modifications →")
            : adminOrganizerId
              ? t("Créer pour cet organisateur →")
              : t("Soumettre à la validation →")}
      </button>

      {adminOrganizerId ? (
        <p className="text-center text-xs text-ink-5">{t("L'événement sera créé sous le compte de l'organisateur puis soumis à validation — vous serez redirigé vers sa fiche pour la traiter.")}</p>
      ) : mode === "create" ? (
        <p className="text-center text-xs text-ink-5">{t("⏱️ Délai de traitement : 48h ouvrées maximum")}</p>
      ) : (
        <p className="text-center text-xs text-ink-5">{t("⏱️ Toute modification substantielle repasse en validation (48h ouvrées).")}</p>
      )}
    </form>
  );
}
