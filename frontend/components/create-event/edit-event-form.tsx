"use client";

// Formulaire de modification dédié : les champs modifiables dépendent du statut.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoCard } from "@/components/event-detail/info-card";
import { CategoryPicker } from "@/components/create-event/category-picker";
import { VatRateSelect } from "@/components/create-event/vat-rate-select";
import { listVatRates, type ApiVatRate } from "@/lib/api/vat-rates";
import { CoverDropzone } from "@/components/create-event/cover-dropzone";
import { PosterDropzone } from "@/components/create-event/poster-dropzone";
import { LocationPicker } from "@/components/map/location-picker";
import { AddressAutocomplete } from "@/components/create-event/address-autocomplete";
import type { ApiCategory } from "@/lib/api/categories";
import {
  createTicketCategory,
  deleteTicketCategory,
  getEventCategories,
  getPricingPolicy,
  updateEvent,
  updateTicketCategory,
  type ApiEvent,
  type ApiTicketCategory,
  type PricingPolicy,
  type UpdateEventDto,
} from "@/lib/api/events";
import { listTicketTierTypes, type ApiTicketTierType } from "@/lib/api/ticket-tier-types";
import { uploadDocument, uploadPoster } from "@/lib/api/upload";
import { TicketTiersEditor, type TicketTierRow } from "@/components/create-event/ticket-tiers-editor";
import { TicketingTypeToggle } from "@/components/create-event/ticketing-type-toggle";
import { DocumentDropzone } from "@/components/ui/document-dropzone";
import { NonProfitResubmit } from "@/components/dashboard/non-profit-resubmit";
import { euros } from "@/lib/format/money";
import { ApiError } from "@/lib/api/http-error";
import { LocationPinIcon } from "@/components/ui/location-pin-icon";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { t, msg } from "@/lib/i18n/translate";

const fieldClassName = fieldClass("px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50");

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

/** Date (ISO) déjà passée. */
function isInPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/** Ligne de billet exploitable : nom, prix et quota renseignés. */
function isCompleteRow(row: TicketTierRow): boolean {
  return Boolean(row.name.trim() && row.price !== "" && row.quota);
}

const LOCKED_STATUS_MESSAGE: Partial<Record<ApiEvent["status"], string>> = {
  SUSPENDED: msg("Cet événement est suspendu par l'administration — plus aucune modification n'est possible."),
  POSTPONED: msg("Cet événement est reporté — fixez d'abord sa nouvelle date depuis sa page dans votre tableau de bord."),
  CANCELLED: msg("Cet événement est annulé — plus aucune modification n'est possible."),
  TERMINATED: msg("Cet événement est terminé — plus aucune modification n'est possible."),
  ARCHIVED: msg("Cet événement est archivé — plus aucune modification n'est possible."),
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
  const minDatetimeLocal = toDatetimeLocal(new Date().toISOString());
  // Soumis ou publié : seuls les champs cosmétiques restent ouverts ; brouillon : tout.

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
  // event.venue_latitude/longitude sont des string (colonne DECIMAL,
  // cf. lib/api/events.ts) — LocationPicker attend des number.
  const [latitude, setLatitude] = useState<number | null>(
    event.venue_latitude !== null ? Number(event.venue_latitude) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    event.venue_longitude !== null ? Number(event.venue_longitude) : null,
  );
  const [totalCapacity, setTotalCapacity] = useState(String(event.total_capacity));
  const [salesStartAt, setSalesStartAt] = useState(toDatetimeLocal(event.sales_start_date));
  const [salesEndAt, setSalesEndAt] = useState(toDatetimeLocal(event.sales_end_date));
  const [refundPolicy, setRefundPolicy] = useState(event.refund_policy);
  const [accessConditions, setAccessConditions] = useState(event.access_conditions ?? "");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // Couverture enregistrée à retirer (les cartes reprennent l'affiche).
  const [removeCover, setRemoveCover] = useState(false);

  // Billetterie : modifiable en brouillon (événement jamais soumis, ou rejeté),
  // en lecture seule ensuite.
  const [tierTypes, setTierTypes] = useState<ApiTicketTierType[]>([]);
  const [pricing, setPricing] = useState<PricingPolicy | null>(null);
  // Taux de TVA : celui de l'événement, retrouvé dans la liste de l'admin ;
  // « current » s'il n'y figure plus (retiré ou modifié depuis).
  const [vatRates, setVatRates] = useState<ApiVatRate[]>([]);
  // null : pas encore changé par l'organisateur (taux de l'événement).
  const [vatChoice, setVatRateId] = useState<string | null>(null);
  const [ticketCategories, setTicketCategories] = useState<ApiTicketCategory[] | null>(null);
  const [tierRows, setTierRows] = useState<TicketTierRow[]>([]);
  const [isFree, setIsFree] = useState(false);
  const [isNonProfit, setIsNonProfit] = useState(event.is_non_profit);
  const [nonProfitFile, setNonProfitFile] = useState<File | null>(null);

  function applyCategories(list: ApiTicketCategory[]) {
    const active = list.filter((category) => category.is_active);
    setTicketCategories(active);
    setTierRows(
      active.map((category) => ({
        id: category.id,
        name: category.name,
        price: String(Number(category.price_ht)),
        quota: String(category.quota),
        maxPerOrder: String(category.max_per_order),
      })),
    );
    setIsFree(active.length > 0 && active.every((category) => Number(category.price_ht) === 0));
  }

  useEffect(() => {
    Promise.all([
      listTicketTierTypes().catch(() => []),
      getPricingPolicy().catch(() => null),
      getEventCategories(event.id),
      listVatRates().catch(() => []),
    ])
      .then(([types, policy, list, rates]) => {
        setTierTypes(types);
        setPricing(policy);
        applyCategories(list);
        setVatRates(rates);
      })
      .catch(() => setTicketCategories([]));
  }, [event.id]);

  const savedVatId =
    vatRates.find(
      (rate) => Number(rate.rate) === Number(event.vat_rate ?? 0.2) && rate.label === (event.vat_rate_label ?? rate.label),
    )?.id ?? "current";
  const vatRateId = vatChoice ?? savedVatId;
  const selectedVatRate = vatRates.find((rate) => rate.id === vatRateId)?.rate ?? event.vat_rate ?? "0.2";
  const pricingForEvent = pricing ? { ...pricing, tva_rate: Number(selectedVatRate) } : null;

  /** Bascule payant / gratuit : 0 € partout, ou prix à saisir de nouveau. */
  function applyFree(free: boolean) {
    setIsFree(free);
    setTierRows((rows) => rows.map((row) => ({ ...row, price: free ? "0" : "" })));
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Déclenché au clic plutôt qu'à la soumission native du form, parfois bloquée sans erreur.
  async function handleSubmit() {
    setError(null);
    setSaved(false);

    // Pas de date passée ni de fin avant le début, comme à la création.
    if (isDraft) {
      const nextStart = toIsoOrNull(startAt) ?? event.start_date;
      const nextEnd = toIsoOrNull(endAt) ?? event.end_date;
      if (isInPast(nextStart)) {
        setError(t("La date de début ne peut pas être dans le passé."));
        return;
      }
      if (new Date(nextEnd).getTime() <= new Date(nextStart).getTime()) {
        setError(t("La date de fin doit être postérieure à la date de début."));
        return;
      }
      if (tierRows.filter(isCompleteRow).length === 0) {
        setError(
          isFree
            ? t("Ajoutez au moins une catégorie de billet complète (nom, quota).")
            : t("Ajoutez au moins une catégorie de billet complète (nom, prix, quota)."),
        );
        return;
      }
      const totalQuota = tierRows.filter(isCompleteRow).reduce((sum, row) => sum + Number(row.quota), 0);
      if (totalQuota > Number(totalCapacity)) {
        setError(t("La somme des quotas ({totalQuota}) dépasse la capacité totale ({totalCapacity}).", { totalQuota, totalCapacity }));
        return;
      }
      if (isNonProfit && !nonProfitFile && !event.non_profit_document_url) {
        setError(t("Joignez un justificatif pour la déclaration à but non lucratif."));
        return;
      }
    }

    setSubmitting(true);
    try {
      let posterUrl: string | undefined;
      if (posterFile) {
        const result = await uploadPoster(posterFile);
        posterUrl = result.url;
      }
      const coverUrl = coverFile ? (await uploadPoster(coverFile)).url : undefined;
      const coverChange = coverUrl ? { cover_url: coverUrl } : removeCover && event.cover_url ? { cover_url: null } : {};
      const nonProfitDocumentUrl =
        isDraft && isNonProfit && nonProfitFile ? (await uploadDocument(nonProfitFile)).url : undefined;

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
            ...(latitude !== null && longitude !== null
              ? { venue_latitude: latitude, venue_longitude: longitude }
              : {}),
            total_capacity: Number(totalCapacity),
            sales_start_date: toIsoOrNull(salesStartAt) ?? event.sales_start_date,
            sales_end_date: toIsoOrNull(salesEndAt) ?? event.sales_end_date,
            // Rien à rembourser sur une entrée gratuite.
            refund_policy: isFree ? "NON_REFUNDABLE" : refundPolicy,
            is_non_profit: isNonProfit,
            ...(isNonProfit && (nonProfitDocumentUrl ?? event.non_profit_document_url)
              ? { non_profit_document_url: nonProfitDocumentUrl ?? event.non_profit_document_url ?? undefined }
              : {}),
            ...(posterUrl ? { poster_url: posterUrl } : {}),
            ...coverChange,
            ...(vatRateId !== "current" ? { vat_rate_id: vatRateId } : {}),
          }
        : {
            description,
            access_conditions: accessConditions || undefined,
            ...(posterUrl ? { poster_url: posterUrl } : {}),
            ...coverChange,
          };

      const updated = await updateEvent(event.id, dto);
      if (isDraft) await syncTicketCategories();
      setEvent(updated);
      setPosterFile(null);
      setCoverFile(null);
      setRemoveCover(false);
      setNonProfitFile(null);
      setSaved(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // Garde une trace exploitable dans la console même si la bannière
      // d'erreur passe inaperçue (ex: hors du viewport au moment du clic).
      console.error("[EditEventForm] échec de l'enregistrement :", err);
      setError(err instanceof ApiError ? err.message : t("Impossible d'enregistrer les modifications."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  }

  /** Billets d'un brouillon alignés sur le formulaire : suppressions, puis modifications, puis créations. */
  async function syncTicketCategories() {
    const existing = new Map((ticketCategories ?? []).map((category) => [category.id, category]));
    const rows = tierRows.filter(isCompleteRow);
    const kept = new Set(rows.map((row) => row.id).filter((id) => existing.has(id)));
    for (const category of existing.values()) {
      if (!kept.has(category.id)) await deleteTicketCategory(category.id);
    }
    for (const row of rows) {
      const dto = {
        name: row.name,
        price_ht: Number(row.price),
        quota: Number(row.quota),
        ...(row.maxPerOrder ? { max_per_order: Number(row.maxPerOrder) } : {}),
      };
      const current = existing.get(row.id);
      if (!current) {
        await createTicketCategory(event.id, dto);
      } else if (
        current.name !== dto.name ||
        Number(current.price_ht) !== dto.price_ht ||
        current.quota !== dto.quota ||
        (dto.max_per_order !== undefined && current.max_per_order !== dto.max_per_order)
      ) {
        await updateTicketCategory(row.id, dto);
      }
    }
    applyCategories(await getEventCategories(event.id));
  }

  if (isFullyLocked) {
    return (
      <InfoCard icon="🔒" title={t("Modification impossible")}>
        <p className="text-sm text-ink-4">{LOCKED_STATUS_MESSAGE[event.status]}</p>
      </InfoCard>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {!isDraft ? (
        <Alert tone="warning">
          {event.status === "PUBLISHED"
            ? t("Cet événement est publié — seuls la description, l'affiche et les conditions d'accès restent modifiables (ainsi qu'un justificatif refusé), pour ne pas changer les informations sur lesquelles les acheteurs se sont déjà engagés.")
            : t("Cet événement est en attente de validation — seuls la description, l'affiche et les conditions d'accès restent modifiables (ainsi qu'un justificatif refusé), pour ne pas changer les informations sur lesquelles les acheteurs se sont déjà engagés.")}
        </Alert>
      ) : null}

      {error ? (
        <Alert>{error}</Alert>
      ) : null}
      {saved ? (
        <Alert tone="success">{t("✓ Modifications enregistrées.")}</Alert>
      ) : null}

      <InfoCard icon="📝" title={t("Informations générales")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Titre")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isDraft}
              className={fieldClassName}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Description")}</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${fieldClassName} resize-none`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Catégorie")}</span>
            {isDraft ? (
              <CategoryPicker categories={categories} value={category} onChange={setCategory} />
            ) : (
              <input value={categories.find((c) => c.code === category)?.label ?? category} disabled className={fieldClassName} />
            )}
          </label>
          <VatRateSelect
            vatRates={vatRates}
            value={vatRateId}
            onChange={setVatRateId}
            disabled={!isDraft}
            current={vatRateId === "current" ? { rate: event.vat_rate ?? "0.2", label: event.vat_rate_label ?? null } : null}
          />
        </div>
      </InfoCard>

      <InfoCard icon="🖼️" title={t("Affiche")}>
        <PosterDropzone onFileSelected={setPosterFile} initialPreviewUrl={event.poster_url} />
      </InfoCard>

      <InfoCard icon="🌄" title={t("Image de couverture (facultatif)")}>
        <CoverDropzone
          onFileSelected={(file) => {
            setCoverFile(file);
            setRemoveCover(false);
          }}
          initialPreviewUrl={removeCover ? null : event.cover_url}
          onRemove={() => {
            setCoverFile(null);
            setRemoveCover(true);
          }}
        />
      </InfoCard>

      <InfoCard icon="📅" title={t("Dates")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Début")}</span>
            <input type="datetime-local" min={minDatetimeLocal} value={startAt} onChange={(e) => setStartAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Fin")}</span>
            <input type="datetime-local" min={startAt || minDatetimeLocal} value={endAt} onChange={(e) => setEndAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Début des ventes")}</span>
            <input type="datetime-local" min={minDatetimeLocal} value={salesStartAt} onChange={(e) => setSalesStartAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Fin des ventes")}</span>
            <input type="datetime-local" min={salesStartAt || minDatetimeLocal} value={salesEndAt} onChange={(e) => setSalesEndAt(e.target.value)} disabled={!isDraft} className={fieldClassName} />
          </label>
        </div>
      </InfoCard>

      <InfoCard icon={<LocationPinIcon />} title={t("Lieu")}>
        <div className="flex flex-col gap-4">
          <input value={venueName} onChange={(e) => setVenueName(e.target.value)} disabled={!isDraft} placeholder={t("Nom du lieu")} className={fieldClassName} />
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
            disabled={!isDraft}
            placeholder={t("Adresse")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input value={city} onChange={(e) => setCity(e.target.value)} disabled={!isDraft} placeholder={t("Ville")} className={fieldClassName} />
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} disabled={!isDraft} placeholder={t("Code postal")} className={fieldClassName} />
            <input value={country} onChange={(e) => setCountry(e.target.value)} disabled={!isDraft} placeholder={t("Pays")} className={fieldClassName} />
          </div>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
            disabled={!isDraft}
          />
        </div>
      </InfoCard>

      <InfoCard icon="🎟️" title={t("Capacité, remboursement et accès")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Capacité totale")}</span>
            <input
              type="number"
              min="1"
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
              disabled={!isDraft}
              className={fieldClassName}
            />
          </label>
          {isFree ? null : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Politique de remboursement")}</span>
            <select
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value as "NON_REFUNDABLE" | "REFUNDABLE")}
              disabled={!isDraft}
              className={fieldClassName}
            >
              <option value="NON_REFUNDABLE" className="bg-card">{t("Non remboursable")}</option>
              <option value="REFUNDABLE" className="bg-card">{t("Remboursable")}</option>
            </select>
          </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">{t("Conditions d'accès")}</span>
            <textarea
              rows={3}
              value={accessConditions}
              onChange={(e) => setAccessConditions(e.target.value)}
              placeholder={t("Ex : pièce d'identité obligatoire, interdit aux moins de 16 ans…")}
              className={`${fieldClassName} resize-none`}
            />
          </label>
        </div>
      </InfoCard>

      <InfoCard icon="✏️" title={t("Billetterie")}>
        {ticketCategories === null ? (
          <p className="text-sm text-ink-5">{t("Chargement des billets…")}</p>
        ) : isDraft ? (
          <div className="flex flex-col gap-4">
            <TicketingTypeToggle free={isFree} onChange={applyFree} />
            <TicketTiersEditor
              rows={tierRows}
              onChange={setTierRows}
              tierTypes={tierTypes}
              totalCapacity={Number(totalCapacity) || 0}
              pricing={pricingForEvent}
              free={isFree}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-ink-1">{isFree ? t("Entrée gratuite, sur réservation") : t("Billetterie payante")}</p>
            <ul className="divide-y divide-hairline-1 rounded-xl border border-hairline-1">
              {ticketCategories.map((category) => (
                <li key={category.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="text-ink-1">{category.name}</span>
                  <span className="text-ink-4">
                    {Number(category.price_ht) === 0 ? t("Gratuit") : t("{price} TTC", { price: euros.format(category.price_ttc) })} · {t("{count} places", { count: category.quota })} ·{" "}
                    {t("{count} vendues", { count: category.quota - category.remaining_quota })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-5">{t("Les billets ne changent plus une fois l'événement soumis : les acheteurs gardent le prix qu'ils ont payé.")}</p>
          </div>
        )}
      </InfoCard>

      <InfoCard icon="🤝" title={t("Événement à but non lucratif")}>
        {isDraft ? (
          <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isNonProfit}
                onChange={(e) => {
                  const nonProfit = e.target.checked;
                  setIsNonProfit(nonProfit);
                  // Proposé en gratuit par défaut ; « Payant » reste possible (gala caritatif…).
                  if (nonProfit && !isFree) applyFree(true);
                }}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-ink-3">{t("Cet événement est organisé à but non lucratif (association, action caritative…). Après vérification du justificatif par un administrateur, la commission de la plateforme ne s'applique pas.")}</span>
            </label>
            {isNonProfit ? (
              <>
                {event.non_profit_document_url && !nonProfitFile ? (
                  <p className="text-xs text-ink-5">{t("Justificatif déjà fourni. Déposez-en un autre pour le remplacer.")}</p>
                ) : null}
                <DocumentDropzone
                  onFileSelected={setNonProfitFile}
                  disabled={submitting}
                  hint={t("Glissez le justificatif (statuts, récépissé de déclaration…) ou cliquez")}
                />
              </>
            ) : null}
          </div>
        ) : !event.is_non_profit ? (
          <p className="text-sm text-ink-4">{t("Événement non déclaré à but non lucratif.")}</p>
        ) : event.non_profit_verified ? (
          <p className="text-sm text-emerald-600">{t("Justificatif vérifié : la commission de la plateforme ne s'applique pas.")}</p>
        ) : event.non_profit_rejected_at ? (
          <NonProfitResubmit event={event} onSubmitted={() => router.refresh()} />
        ) : (
          <p className="text-sm text-ink-4">{t("Justificatif en cours de vérification par l'administration.")}</p>
        )}
      </InfoCard>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/evenements/${event.id}`)}
          className={buttonClass("secondary", "rounded-full px-5 py-2.5 text-sm")}
        >{t("← Retour")}</button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={buttonClass("primary", "rounded-full px-6 py-2.5 text-sm disabled:opacity-50")}
        >
          {submitting ? t("Enregistrement…") : t("Enregistrer les modifications")}
        </button>
      </div>
    </div>
  );
}
