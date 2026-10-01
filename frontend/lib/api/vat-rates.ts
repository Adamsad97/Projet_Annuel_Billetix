// Taux de TVA proposés à la création d'un événement — GET /events/vat-rates
// (liste gérée depuis l'espace Admin, cf. backend/event-service/src/vat-rate).

import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export interface ApiVatRate {
  id: string;
  label: string;
  /** Fraction en texte (colonne décimale) : « 0.0550 » pour 5,5 %. */
  rate: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
}

/** Taux actifs, pour la liste déroulante de l'organisateur. */
export function listVatRates(): Promise<ApiVatRate[]> {
  return apiGet<ApiVatRate[]>("/events/vat-rates");
}

/** Tous les taux, désactivés compris (espace Admin). */
export function listAllVatRates(): Promise<ApiVatRate[]> {
  return apiGet<ApiVatRate[]>("/events/vat-rates/all");
}

export function createVatRate(dto: { label: string; rate: number; is_default?: boolean }): Promise<ApiVatRate> {
  return apiPost<ApiVatRate>("/events/vat-rates", dto);
}

export function updateVatRate(
  id: string,
  dto: { label?: string; rate?: number; is_default?: boolean; is_active?: boolean },
): Promise<ApiVatRate> {
  return apiPatch<ApiVatRate>(`/events/vat-rates/${id}`, dto);
}

export function deleteVatRate(id: string): Promise<{ success: true }> {
  return apiDelete<{ success: true }>(`/events/vat-rates/${id}`);
}

/** « 5,5 % » à partir d'une fraction (0.055 ou « 0.0550 »). */
export function formatVatPercent(rate: number | string): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(rate) * 100)} %`;
}

/** « 5,5 % — Spectacles vivants » pour les listes déroulantes. */
export function vatRateOptionLabel(vatRate: Pick<ApiVatRate, "rate" | "label">): string {
  return `${formatVatPercent(vatRate.rate)} — ${vatRate.label}`;
}
