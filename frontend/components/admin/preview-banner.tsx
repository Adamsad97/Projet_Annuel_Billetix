"use client";

// Bandeau du mode aperçu (autre rôle, lecture seule), pour en changer ou en sortir.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PreviewSwitcher } from "@/components/admin/preview-switcher";
import {
  getPreviewRole,
  PREVIEW_CHANGED_EVENT,
  previewLabel,
  stopPreview,
  type PreviewRole,
} from "@/lib/auth/preview";
import { SESSION_ENDED_EVENT } from "@/lib/auth/session";
import { t } from "@/lib/i18n/translate";

export function PreviewBanner() {
  const router = useRouter();
  const [role, setRole] = useState<PreviewRole | null>(null);

  useEffect(() => {
    const sync = () => setRole(getPreviewRole());
    sync();
    window.addEventListener(PREVIEW_CHANGED_EVENT, sync);
    window.addEventListener(SESSION_ENDED_EVENT, sync);
    return () => {
      window.removeEventListener(PREVIEW_CHANGED_EVENT, sync);
      window.removeEventListener(SESSION_ENDED_EVENT, sync);
    };
  }, []);

  if (!role) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-ink-1 backdrop-blur"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">{t("👁 Mode aperçu : {previewLabel}", { previewLabel: previewLabel(role) })}</span>
          <span className="text-ink-3">
            {" "}{t("— lecture seule : les actions sont désactivées, et les espaces personnels sont vides (votre compte administrateur n'a pas de données de ce rôle).")}</span>
        </p>
        <div className="flex items-center gap-2">
          <PreviewSwitcher current={role} compact />
          <button
            type="button"
            onClick={() => {
              stopPreview();
              router.push("/admin");
            }}
            className="rounded-full bg-ink-1 px-4 py-2 text-sm font-semibold text-page transition-opacity hover:opacity-90"
          >{t("Quitter l'aperçu")}</button>
        </div>
      </div>
    </div>
  );
}
