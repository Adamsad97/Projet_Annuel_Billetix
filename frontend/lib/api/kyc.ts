// Client pour /users/organizer/kyc (api-gateway) : vérification d'identité
// de l'organisateur, examinée par un admin.

import { apiGet, apiPost } from "./client";

export type KycStatus = "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";

export interface ApiKycStatus {
  kyc_status: KycStatus;
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  kyc_rejected_reason: string | null;
}

export function getKycStatus(): Promise<ApiKycStatus> {
  return apiGet<ApiKycStatus>("/users/organizer/kyc");
}

/** `documentUrl` : adresse renvoyée par uploadDocument (lib/api/upload.ts). */
export function submitKyc(documentUrl: string): Promise<unknown> {
  return apiPost("/users/organizer/kyc", { document_url: documentUrl });
}
