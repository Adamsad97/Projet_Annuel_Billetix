"use client";

export function SearchBar() {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="mt-2 flex w-full max-w-2xl items-center gap-2 rounded-full bg-white/5 p-2 ring-1 ring-inset ring-white/10"
    >
      <input
        type="text"
        placeholder="Concert, festival, sport, conférence…"
        className="w-full bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow shadow-violet-900/40 transition-opacity hover:opacity-90"
      >
        Chercher
      </button>
    </form>
  );
}
