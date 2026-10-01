import { PageShell } from "@/components/layout/page-shell";
import { NotificationPrefsManager } from "@/components/profile/notification-prefs-manager";
import { BackLink } from "@/components/ui/back-link";

export default function NotificationPrefsPage() {
  return (
    <PageShell width="lg">
      <BackLink href="/profil">Profil</BackLink>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink-1">Notifications</h1>
        <p className="mt-1 text-sm text-ink-5">
          Choisissez les emails que vous souhaitez recevoir de BilleTix.
        </p>
      </div>

      <NotificationPrefsManager />
    </PageShell>
  );
}
