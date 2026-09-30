// Client pour /users/organizer/profile (api-gateway) : vitrine de
// l'organisateur (nom public, présentation, logo, liens).

import { apiGet, apiPatch, apiPost } from "./client";
import type { AuthUser } from "./auth";

export interface ApiOrganizerProfile {
  id: string;
  user_id: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_youtube: string | null;
  kyc_status: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  stripe_connect_onboarded: boolean;
}

export interface OrganizerProfileInput {
  display_name: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  social_instagram?: string;
  social_facebook?: string;
  social_twitter?: string;
  social_youtube?: string;
}

/**
 * Réponse de création : un acheteur devient organisateur, la passerelle
 * renvoie alors de nouveaux jetons portant le rôle ORGANIZER.
 */
export interface CreateOrganizerProfileResult {
  profile: ApiOrganizerProfile;
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
}

export function getOrganizerProfile(): Promise<ApiOrganizerProfile> {
  return apiGet<ApiOrganizerProfile>("/users/organizer/profile");
}

// Création : seuls les champs acceptés par CreateOrganizerProfileDto ; les
// réseaux sociaux suivent via une mise à jour.
export function createOrganizerProfile(input: OrganizerProfileInput): Promise<CreateOrganizerProfileResult> {
  const { display_name, description, logo_url, website_url } = input;
  return apiPost<CreateOrganizerProfileResult>("/users/organizer/profile", {
    display_name,
    description,
    logo_url,
    website_url,
  });
}

/** `null` efface un champ facultatif (lien retiré, par exemple). */
export type OrganizerProfileUpdate = { [K in keyof OrganizerProfileInput]?: OrganizerProfileInput[K] | null };

export function updateOrganizerProfile(input: OrganizerProfileUpdate): Promise<ApiOrganizerProfile> {
  return apiPatch<ApiOrganizerProfile>("/users/organizer/profile", input);
}
