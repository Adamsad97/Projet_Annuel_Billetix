"use client";

// Choix du rôle à prévisualiser (admin uniquement) — cf. lib/auth/preview.ts.

import { useRouter } from "next/navigation";
import { PREVIEW_ROLES, previewHome, startPreview, type PreviewRole } from "@/lib/auth/preview";
import { t } from "@/lib/i18n/translate";

export function PreviewSwitcher({ current, compact = false }: { current?: PreviewRole | null; compact?: boolean }) {
  const router = useRouter();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("Voir la plateforme en tant que")}</span>
      <select
        value={current ?? ""}
        onChange={(event) => {
          const role = event.target.value as PreviewRole;
          if (!role) return;
          startPreview(role);
          router.push(previewHome(role));
        }}
        className={`cursor-pointer appearance-none rounded-full border border-hairline-3 bg-card py-2 pl-3 pr-8 text-sm font-medium text-ink-2 transition-colors hover:border-hairline-5 hover:text-ink-1 focus:border-blue-500 focus:outline-none ${compact ? "max-w-[9rem]" : ""}`}
      >
        <option value="" disabled>{t("👁 Voir en tant que…")}</option>
        {PREVIEW_ROLES.map((option) => (
          <option key={option.role} value={option.role}>
            {t(option.label)}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 text-xs text-ink-5">
        ▾
      </span>
    </label>
  );
}
