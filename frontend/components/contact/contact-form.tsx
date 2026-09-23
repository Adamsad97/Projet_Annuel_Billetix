"use client";

import { useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#12101c] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </div>
        <h2 className="text-lg font-bold text-white">Message envoyé</h2>
        <p className="mt-2 text-sm text-gray-500">
          Notre équipe te répond généralement sous 24h ouvrées.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSent(true);
      }}
      className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#12101c] p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Nom</span>
          <input
            type="text"
            required
            placeholder="Jean Dupont"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-violet-200/80">Email</span>
          <input
            type="email"
            required
            placeholder="jean.dupont@email.com"
            className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-violet-200/80">Sujet</span>
        <select className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-violet-500 focus:outline-none">
          <option>Question sur une commande</option>
          <option>Problème avec un billet</option>
          <option>Devenir organisateur</option>
          <option>Autre</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-violet-200/80">Message</span>
        <textarea
          required
          rows={5}
          placeholder="Explique-nous ta demande…"
          className="resize-none rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        className="mt-1 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90"
      >
        Envoyer le message →
      </button>
    </form>
  );
}
