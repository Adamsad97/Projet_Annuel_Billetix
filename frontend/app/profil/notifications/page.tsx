import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { NotificationPrefsManager } from "@/components/profile/notification-prefs-manager";

export default function NotificationPrefsPage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <Link
          href="/profil"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Profil
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-ink-1">Notifications</h1>
          <p className="mt-1 text-sm text-ink-5">
            Choisissez les emails que vous souhaitez recevoir de BilletiX.
          </p>
        </div>

        <NotificationPrefsManager />
      </main>
    </div>
  );
}
