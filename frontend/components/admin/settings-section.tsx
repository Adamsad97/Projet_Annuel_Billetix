"use client";

import { useState } from "react";
import type { SettingsSection } from "@/lib/mock/admin-settings";

export function SettingsSectionCard({ section }: { section: SettingsSection }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(section.fields.map((field) => [field.key, field.value])),
  );
  const [saved, setSaved] = useState(false);

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-200">
            <span>{section.icon}</span>
            {section.title}
          </h2>
          <p className="mt-1 text-xs text-gray-500">{section.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setSaved(true)}
          className={
            saved
              ? "shrink-0 rounded-lg bg-emerald-500/15 px-3.5 py-2 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
              : "shrink-0 rounded-lg bg-violet-600/20 px-3.5 py-2 text-xs font-medium text-violet-200 ring-1 ring-inset ring-violet-500/30 transition-colors hover:bg-violet-600/30"
          }
        >
          {saved ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-violet-200/80">
              {field.label}
            </span>
            <div className="flex items-center gap-2">
              <input
                type={field.type === "text" ? "text" : "text"}
                inputMode={field.type === "number" ? "numeric" : undefined}
                value={values[field.key]}
                onChange={(event) => updateValue(field.key, event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              />
              {field.unit ? (
                <span className="shrink-0 text-xs text-gray-500">{field.unit}</span>
              ) : null}
            </div>
            {field.description ? (
              <span className="text-xs text-gray-600">{field.description}</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}
