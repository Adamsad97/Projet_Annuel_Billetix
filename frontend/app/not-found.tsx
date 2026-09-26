import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar />

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <span className="text-6xl">🎫</span>
        <h1 className="text-3xl font-extrabold text-ink-1">
          Page introuvable
        </h1>
        <p className="max-w-sm text-sm text-ink-5">
          Cette page n&apos;existe pas, ou a changé d&apos;adresse.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
