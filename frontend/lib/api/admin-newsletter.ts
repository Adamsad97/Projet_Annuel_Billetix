// Client pour /admin/newsletter (backend/api-gateway/src/admin/admin.controller.ts).

import { apiGet, apiPost } from "./client";

export function getNewsletterRecipientsCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>("/admin/newsletter/recipients-count");
}

export function sendNewsletter(subject: string, body: string): Promise<{ sent: number }> {
  return apiPost<{ sent: number }>("/admin/newsletter/send", { subject, body });
}
