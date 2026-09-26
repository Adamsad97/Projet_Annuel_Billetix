// Client pour /users/buyer/profile (api-gateway) : adresse de facturation.

import { apiGet, apiPatch } from "./client";

export interface ApiBuyerProfile {
  user_id: string;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
}

export type BillingAddress = Partial<Omit<ApiBuyerProfile, "user_id">>;

export function getBuyerProfile(): Promise<ApiBuyerProfile> {
  return apiGet<ApiBuyerProfile>("/users/buyer/profile");
}

export function updateBuyerProfile(dto: BillingAddress): Promise<ApiBuyerProfile> {
  return apiPatch<ApiBuyerProfile>("/users/buyer/profile", dto);
}
