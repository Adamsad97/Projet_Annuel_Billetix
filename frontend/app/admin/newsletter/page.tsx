import { AdminShell } from "@/components/layout/admin-shell";
import { NewsletterComposer } from "@/components/admin/newsletter-composer";
import { getT } from "@/lib/i18n/server";

export default async function AdminNewsletterPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/newsletter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Newsletter")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Envoyez un email ponctuel à tous les acheteurs abonnés à la newsletter depuis leurs préférences de notification.")}</p>
      </div>

      <NewsletterComposer />
    </AdminShell>
  );
}
