// Client pour les catégories d'événement — GET /events/categories(/all) et
// CRUD /events/categories (backend/api-gateway/src/event/event.controller.ts,
// liste gérée depuis l'espace Admin, cf. backend/event-service/src/category).

import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import { ApiError, extractErrorMessage } from "./http-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface ApiCategory {
  id: string;
  code: string;
  label: string;
  emoji: string | null;
  display_order: number;
  is_active: boolean;
}

// Lecture publique (pas de token requis) — safe à appeler depuis un
// composant serveur, même pattern que listPublishedEvents.
async function getPublicJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`);
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur — vérifie ta connexion ou réessaie plus tard.");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Réponse sans corps JSON.
  }
  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(data, "Une erreur est survenue, réessaie."));
  }
  return data as T;
}

/** Catégories actives, pour le dropdown organisateur et les filtres catalogue. */
export function listCategories(): Promise<ApiCategory[]> {
  return getPublicJson<ApiCategory[]>("/events/categories");
}

/** Toutes les catégories, y compris désactivées — réservé à l'espace Admin. */
export function listAllCategories(): Promise<ApiCategory[]> {
  return apiGet<ApiCategory[]>("/events/categories/all");
}

export interface CreateCategoryDto {
  code: string;
  label: string;
  emoji?: string;
  display_order?: number;
}

export function createCategory(dto: CreateCategoryDto): Promise<ApiCategory> {
  return apiPost<ApiCategory>("/events/categories", dto);
}

export interface UpdateCategoryDto {
  label?: string;
  emoji?: string;
  display_order?: number;
  is_active?: boolean;
}

export function updateCategory(id: string, dto: UpdateCategoryDto): Promise<ApiCategory> {
  return apiPatch<ApiCategory>(`/events/categories/${id}`, dto);
}

export function deleteCategory(id: string): Promise<{ success: true }> {
  return apiDelete<{ success: true }>(`/events/categories/${id}`);
}
