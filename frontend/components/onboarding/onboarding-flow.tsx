"use client";

import { useState } from "react";

const steps = ["Type de compte", "Coordonnées bancaires", "Vérification d'identité"];
const fieldClassName =
  "rounded-xl border border-hairline-2 bg-hairline-1 px-4 py-3 text-sm text-ink-1 placeholder:text-ink-6 focus:border-blue-500 focus:outline-none";

export function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-2xl border border-hairline-1 bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-2xl">
          ⏳
        </div>
        <h1 className="text-lg font-bold text-ink-1">Vérification en cours</h1>
        <p className="mt-2 text-sm text-ink-5">
          Votre dossier a été transmis à Stripe pour vérification (KYC). Cela
          prend généralement 24 à 48h. Vous recevrez un email dès que vos
          reversements seront activés.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline-1 bg-card p-6">
      <ol className="mb-6 flex items-center gap-2">
        {steps.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={
                index <= stepIndex
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white"
                  : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hairline-2 text-xs font-bold text-ink-4"
              }
            >
              {index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span className={index < stepIndex ? "h-0.5 flex-1 bg-blue-600" : "h-0.5 flex-1 bg-hairline-2"} />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mb-6 text-sm font-medium text-accent">{steps[stepIndex]}</p>

      {stepIndex === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: "individual", label: "Particulier", description: "Auto-entrepreneur, association" },
              { id: "company", label: "Entreprise", description: "SAS, SARL, etc." },
            ] as const
          ).map((option) => {
            const isActive = option.id === accountType;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccountType(option.id)}
                className={
                  isActive
                    ? "flex flex-col items-start gap-1 rounded-xl border border-blue-500 bg-blue-500/10 p-4 text-left"
                    : "flex flex-col items-start gap-1 rounded-xl border border-hairline-2 bg-hairline-1 p-4 text-left transition-colors hover:border-hairline-4"
                }
              >
                <span className="font-semibold text-ink-1">{option.label}</span>
                <span className="text-xs text-ink-5">{option.description}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">Titulaire du compte</span>
            <input type="text" placeholder="Adama Diawara" className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">IBAN</span>
            <input type="text" placeholder="FR76 3000 6000 0112 3456 7890 189" className={fieldClassName} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-accent/80">BIC</span>
            <input type="text" placeholder="AGRIFRPP123" className={fieldClassName} />
          </label>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hairline-2 bg-hairline-1 py-10 text-center">
          <span className="text-2xl">🪪</span>
          <span className="text-sm text-ink-5">
            Glissez une pièce d&apos;identité ou cliquez — JPG/PNG/PDF max 5 Mo
          </span>
        </div>
      ) : null}

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((s) => s - 1)}
          className="rounded-full border border-hairline-3 px-5 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Précédent
        </button>
        <button
          type="button"
          onClick={() => (stepIndex < steps.length - 1 ? setStepIndex((s) => s + 1) : setDone(true))}
          className="rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 transition-opacity hover:opacity-90"
        >
          {stepIndex < steps.length - 1 ? "Suivant →" : "Envoyer pour vérification"}
        </button>
      </div>
    </div>
  );
}
