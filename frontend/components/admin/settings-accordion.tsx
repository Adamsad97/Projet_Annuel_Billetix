"use client";

// Paramètres en accordéon, une section à la fois, sections sensibles réservées au super admin ; seuls les champs modifiés sont enregistrés.

import { useEffect, useMemo, useState } from "react";
import { listPlatformSettings, updatePlatformSetting, type ApiPlatformSetting } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { FIELDS, fromInput, SECTION_ORDER, SECTIONS, settingLabel, toInput } from "@/lib/admin/settings-catalog";
import { cardClass } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/field";
import { t } from "@/lib/i18n/translate";

interface SectionGroup {
  id: string;
  superAdminOnly: boolean;
  settings: ApiPlatformSetting[];
}

export function SettingsAccordion() {
  const [settings, setSettings] = useState<ApiPlatformSetting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    listPlatformSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger les paramètres.")));
  }, []);

  const groups = useMemo<SectionGroup[]>(() => {
    if (!settings) return [];
    const byId = new Map<string, SectionGroup>();
    for (const setting of settings) {
      const group = byId.get(setting.section) ?? { id: setting.section, superAdminOnly: setting.super_admin_only, settings: [] };
      group.settings.push(setting);
      byId.set(setting.section, group);
    }
    const rank = (id: string) => (SECTION_ORDER.indexOf(id) === -1 ? SECTION_ORDER.length : SECTION_ORDER.indexOf(id));
    // Dans une section : ordre logique du catalogue, pas l'ordre alphabétique des clés.
    const fieldOrder = Object.keys(FIELDS);
    const fieldRank = (key: string) => (fieldOrder.indexOf(key) === -1 ? fieldOrder.length : fieldOrder.indexOf(key));
    for (const group of byId.values()) group.settings.sort((a, b) => fieldRank(a.key) - fieldRank(b.key));
    return [...byId.values()].sort((a, b) => rank(a.id) - rank(b.id));
  }, [settings]);

  function applySaved(saved: ApiPlatformSetting[]) {
    setSettings((current) =>
      current ? current.map((setting) => saved.find((item) => item.key === setting.key) ?? setting) : current,
    );
  }

  if (settings === null) {
    return <p className={cardClass("px-5 py-6 text-sm text-ink-5")}>{error ?? t("Chargement…")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <SectionPanel
          key={group.id}
          group={group}
          open={openId === group.id}
          onToggle={() => setOpenId((current) => (current === group.id ? null : group.id))}
          onSaved={applySaved}
        />
      ))}
    </div>
  );
}

function SectionPanel({
  group,
  open,
  onToggle,
  onSaved,
}: {
  group: SectionGroup;
  open: boolean;
  onToggle: () => void;
  onSaved: (saved: ApiPlatformSetting[]) => void;
}) {
  const meta = SECTIONS[group.id] ?? SECTIONS.other;
  const initial = useMemo(
    () => Object.fromEntries(group.settings.map((setting) => [setting.key, toInput(setting.key, setting.value)])),
    [group.settings],
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Nouvelles valeurs du serveur (après enregistrement) : on repart d'elles.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resynchronise le formulaire sur les valeurs enregistrées
    setValues(initial);
  }, [initial]);

  const changedKeys = group.settings.map((setting) => setting.key).filter((key) => values[key] !== initial[key]);
  const panelId = `settings-${group.id}`;

  async function save() {
    setMessage(null);
    const invalid = changedKeys.find((key) => fromInput(key, values[key]) === null);
    if (invalid) {
      setMessage({ kind: "error", text: `Valeur invalide : ${settingLabel(invalid)}.` });
      return;
    }
    setSaving(true);
    const saved: ApiPlatformSetting[] = [];
    try {
      for (const key of changedKeys) {
        const result = await updatePlatformSetting(key, fromInput(key, values[key]) as string);
        const original = group.settings.find((setting) => setting.key === key)!;
        saved.push({ ...original, value: result.value });
      }
      setMessage({ kind: "success", text: (saved.length > 1 ? t("{length} paramètres enregistrés.", { length: saved.length }) : t("{length} paramètre enregistré.", { length: saved.length })) });
    } catch (err) {
      setMessage({
        kind: "error",
        text: `${saved.length ? t("{length} enregistré(s), puis erreur : ", { length: saved.length }) : ""}${err instanceof ApiError ? err.message : t("L'enregistrement a échoué.")}`,
      });
    } finally {
      if (saved.length) onSaved(saved);
      setSaving(false);
    }
  }

  return (
    <section className={cardClass("overflow-hidden")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-hairline-1"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="text-lg" aria-hidden="true">
            {meta.icon}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-1">
              {t(meta.title)}
              {group.superAdminOnly ? (
                // Indication discrète : section invisible pour un admin.
                <span title={t("Visible uniquement par le super admin")} className="inline-flex text-ink-5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <span className="sr-only">{t("Visible uniquement par le super admin")}</span>
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-ink-5">{t(meta.description)}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-ink-5">
          {group.settings.length}{" "}{t("réglage")}{group.settings.length > 1 ? "s" : ""}
          <span aria-hidden="true" className={`text-base transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-hairline-1 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {group.settings.map((setting) => {
              const field = FIELDS[setting.key];
              const isText = field?.format === "text" || setting.type === "string";
              return (
                <label key={setting.key} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink-2">{settingLabel(setting.key, setting.description)}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode={isText ? undefined : "decimal"}
                      value={values[setting.key] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [setting.key]: event.target.value }))}
                      className={fieldClass("w-full px-3.5 py-2.5")}
                    />
                    {field?.unit ? <span className="shrink-0 text-xs text-ink-5">{t(field.unit)}</span> : null}
                  </span>
                  {field?.help ? <span className="text-xs text-ink-5">{t(field.help)}</span> : null}
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${message?.kind === "error" ? "text-danger" : "text-success"}`} role="status">
              {message?.text ?? ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="rounded-full border border-hairline-3 px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:border-hairline-5 hover:text-ink-1"
              >{t("Fermer")}</button>
              <button
                type="button"
                onClick={save}
                disabled={saving || changedKeys.length === 0}
                className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? t("Enregistrement…") : changedKeys.length ? `Enregistrer (${changedKeys.length})` : t("Enregistrer")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
