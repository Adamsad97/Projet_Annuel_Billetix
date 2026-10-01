import { AdminShell } from "@/components/layout/admin-shell";
import { ValidationTabs } from "@/components/admin/validation-tabs";
import { getT } from "@/lib/i18n/server";

export default async function AdminValidationPage() {
  const t = await getT();
  return (
    <AdminShell active="/admin/validation">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">{t("Validation des événements")}</h1>
        <p className="mt-1 text-sm text-ink-5">{t("Examinez les événements soumis avant leur publication sur le site.")}</p>
      </div>

      <ValidationTabs />
    </AdminShell>
  );
}
