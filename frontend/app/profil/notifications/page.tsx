import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { NotificationPrefsManager } from "@/components/profile/notification-prefs-manager";

export default function NotificationPrefsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />

      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <Link
          href="/profil"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
        >
          ← Profil
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choisis les emails que tu souhaites recevoir de BilletiX.
          </p>
        </div>

        <NotificationPrefsManager />
      </main>
    </div>
  );
}
