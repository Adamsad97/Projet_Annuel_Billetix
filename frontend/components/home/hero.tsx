import { CategoryFilters } from "@/components/home/category-filters";
import { SearchBar } from "@/components/home/search-bar";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-20 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12rem] h-[32rem] w-[48rem] -translate-x-1/2 rounded-full bg-violet-700/30 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
          🎟️ Plateforme de billetterie sécurisée
        </span>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
          Votre prochain événement
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            commence ici
          </span>
        </h1>

        <p className="max-w-xl text-lg text-gray-400">
          Des milliers d&apos;événements. Billets QR code à usage unique
          envoyés en 5 minutes.
        </p>

        <SearchBar />

        <div className="mt-2">
          <CategoryFilters />
        </div>
      </div>
    </section>
  );
}
