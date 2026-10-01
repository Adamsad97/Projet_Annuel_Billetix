"use client";

import { fieldClass } from "@/components/ui/field";
import { vatRateOptionLabel, type ApiVatRate } from "@/lib/api/vat-rates";
import { t } from "@/lib/i18n/translate";

/** Taux de TVA choisi dans la liste admin ; un taux retiré reste affiché comme « taux actuel ». */
export function VatRateSelect({
  vatRates,
  value,
  onChange,
  current,
  disabled = false,
}: {
  vatRates: ApiVatRate[];
  /** Identifiant du taux choisi ; « current » si le taux actuel n'est plus dans la liste. */
  value: string;
  onChange: (vatRateId: string) => void;
  /** Taux enregistré sur l'événement, quand il ne correspond à aucun taux actif. */
  current?: { rate: string; label: string | null } | null;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-accent">{t("Taux de TVA *")}</span>
      <select
        required
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass("px-4 py-3 disabled:opacity-60")}
      >
        {current ? (
          <option value="current" disabled>{t("{vatRateOptionLabel} (taux actuel)", { vatRateOptionLabel: vatRateOptionLabel({ rate: current.rate, label: current.label ?? "taux actuel" }) })}</option>
        ) : null}
        {vatRates.map((vatRate) => (
          <option key={vatRate.id} value={vatRate.id}>
            {vatRateOptionLabel(vatRate)}
          </option>
        ))}
      </select>
      <span className="text-xs text-ink-5">
        {disabled
          ? t("Le taux est figé une fois l'événement soumis : contactez l'équipe BilleTix pour le corriger.")
          : t("Taux appliqué au prix de vos billets. L'équipe BilleTix le vérifie lors de la validation.")}
      </span>
    </label>
  );
}
