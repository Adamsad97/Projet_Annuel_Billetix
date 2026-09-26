import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { OrdersExplorer } from "@/components/profile/orders-explorer";

export default function MesCommandesPage() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href="/profil"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >
          ← Profil
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-1">Mes commandes</h1>
          <p className="mt-1 text-sm text-ink-5">
            Toutes les commandes passées avec ton compte.
          </p>
        </div>

        <OrdersExplorer />
      </main>
    </div>
  );
}
