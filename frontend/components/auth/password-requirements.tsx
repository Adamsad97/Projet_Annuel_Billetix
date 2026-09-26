"use client";

import type { PasswordRuleStatus } from "@/lib/auth/password-policy";

interface PasswordRequirementsProps {
  rules: PasswordRuleStatus[];
  password: string;
  /** Saisie de confirmation — indique si elle correspond, dès qu'elle est commencée. */
  confirmPassword?: string;
}

/**
 * Barre de progression + pastilles cochées au fil de la frappe. Pastilles
 * courtes plutôt qu'une liste en colonnes : les libellés longs passaient à
 * la ligne et désalignaient les puces.
 */
export function PasswordRequirements({ rules, password, confirmPassword }: PasswordRequirementsProps) {
  const done = rules.filter((rule) => rule.ok).length;
  const remaining = rules.length - done;
  const started = password.length > 0;

  // Rouge tant que moins de la moitié des règles, orange ensuite, vert
  // uniquement quand toutes sont respectées (= accepté par le serveur).
  const tone = remaining === 0 ? "bg-success" : done >= rules.length / 2 ? "bg-warning" : "bg-danger";

  const showMatch = confirmPassword !== undefined && confirmPassword.length > 0;
  const matches = password === confirmPassword;

  return (
    <div className="rounded-xl border border-hairline-2 bg-hairline-1 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-ink-3">Sécurité du mot de passe</span>
        <span aria-live="polite" className={remaining === 0 ? "font-semibold text-success" : "text-ink-5"}>
          {!started
            ? `${rules.length} règles à respecter`
            : remaining === 0
              ? "Mot de passe valide"
              : `${remaining} règle${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="mb-3 flex gap-1" aria-hidden="true">
        {rules.map((rule, index) => (
          <span
            key={rule.id}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              started && index < done ? tone : "bg-hairline-3"
            }`}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {rules.map((rule) => (
          <Pill key={rule.id} ok={rule.ok} label={rule.label} hint={rule.hint} />
        ))}
      </ul>

      {showMatch ? (
        <p
          aria-live="polite"
          className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${matches ? "text-success" : "text-danger"}`}
        >
          {matches ? <CheckIcon /> : <CrossIcon />}
          {matches ? "Les deux mots de passe sont identiques" : "Les deux mots de passe ne correspondent pas"}
        </p>
      ) : null}
    </div>
  );
}

function Pill({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li
      title={hint}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-200 ${
        ok ? "bg-success/10 text-success ring-success/30" : "text-ink-4 ring-hairline-3"
      }`}
    >
      {ok ? <CheckIcon /> : <DotIcon />}
      {label}
      <span className="sr-only">
        {hint ? ` (${hint})` : ""}
        {ok ? " : respecté" : " : manquant"}
      </span>
    </li>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
