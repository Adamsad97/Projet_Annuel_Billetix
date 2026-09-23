"use client";

import { useState, type FormEvent } from "react";
import { changePassword } from "@/lib/api/password";
import { ApiError } from "@/lib/api/http-error";

export function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de modifier le mot de passe.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-sm font-bold text-white">Mot de passe</p>
          {success ? <p className="text-xs text-emerald-400">✓ Modifié avec succès</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setOpen(true);
          }}
          className="shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:border-white/30 hover:text-white"
        >
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="mb-3 text-sm font-bold text-white">Modifier le mot de passe</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Mot de passe actuel"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Nouveau mot de passe (8 caractères min.)"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmer le nouveau mot de passe"
          className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="mt-1 flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="flex-1 rounded-full bg-white/5 py-2.5 text-xs font-medium text-gray-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Modification…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}
