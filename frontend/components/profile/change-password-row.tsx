"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword } from "@/lib/api/password";
import { ApiError } from "@/lib/api/http-error";
import {
  containsPersonalInfo,
  evaluatePassword,
  PERSONAL_INFO_ERROR,
  type PasswordPersonalInfo,
} from "@/lib/auth/password-policy";
import { getStoredUser } from "@/lib/auth/session";
import { useRegistrationPolicy } from "@/lib/auth/use-registration-policy";

export function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [personalInfo, setPersonalInfo] = useState<PasswordPersonalInfo>({});
  const { passwordMinLength: minLength } = useRegistrationPolicy();
  const passwordRules = evaluatePassword(newPassword, minLength);
  const passwordValid = passwordRules.every((rule) => rule.ok);

  // Lu après montage : la session n'existe que côté navigateur.
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersonalInfo({
        firstName: user.first_name,
        lastName: user.last_name,
        birthDate: user.birth_date,
      });
    }
  }, []);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError("Le nouveau mot de passe ne respecte pas toutes les règles indiquées.");
      return;
    }
    if (containsPersonalInfo(newPassword, personalInfo)) {
      setError(PERSONAL_INFO_ERROR);
      return;
    }
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
          <p className="text-sm font-bold text-ink-1">Mot de passe</p>
          {success ? <p className="text-xs text-emerald-400">✓ Modifié avec succès</p> : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setOpen(true);
          }}
          className="shrink-0 rounded-full border border-hairline-3 px-3.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1"
        >
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="mb-3 text-sm font-bold text-ink-1">Modifier le mot de passe</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <PasswordInput
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="Mot de passe actuel"
          className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
        />
        <PasswordInput
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder={`Nouveau mot de passe (${minLength} caractères min.)`}
          className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
        />
        <PasswordInput
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmer le nouveau mot de passe"
          className="rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none"
        />
        <PasswordRequirements
          rules={passwordRules}
          password={newPassword}
          confirmPassword={confirmPassword}
        />
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="mt-1 flex gap-2.5">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="flex-1 rounded-full bg-hairline-1 py-2.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || !passwordValid || newPassword !== confirmPassword}
            className="flex-1 rounded-full bg-blue-700 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Modification…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}
