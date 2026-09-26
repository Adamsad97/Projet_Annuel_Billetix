import { AdminShell } from "@/components/layout/admin-shell";
import { ValidationTabs } from "@/components/admin/validation-tabs";

export default function AdminValidationPage() {
  return (
    <AdminShell active="/admin/validation">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-1">Validation des événements</h1>
        <p className="mt-1 text-sm text-ink-5">
          Examinez les événements soumis avant leur publication sur le catalogue.
        </p>
      </div>

      <ValidationTabs />
    </AdminShell>
  );
}
