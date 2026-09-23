"use client";

// Bug corrigé : les cases à cocher vivaient uniquement en mémoire React —
// tout rechargement de page perdait les choix (ni lus ni enregistrés nulle
// part). Câblé sur user-service (persistance réelle) — la désactivation
// d'une notification n'empêche pas encore son envoi côté backend (chantier
// séparé, service par service).

import { useEffect, useState } from "react";
import { ToggleSwitch } from "@/components/profile/toggle-switch";
import { notificationPrefGroups } from "@/lib/mock/notification-prefs";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/api/notification-prefs";
import { ApiError } from "@/lib/api/http-error";

const defaultValues = Object.fromEntries(
  notificationPrefGroups.flatMap((group) =>
    group.prefs.map((pref) => [pref.id, pref.defaultEnabled]),
  ),
);

export function NotificationPrefsManager() {
  const [values, setValues] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotificationPrefs()
      .then((saved) => {
        if (!cancelled) setValues({ ...defaultValues, ...saved });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossible de charger tes préférences, valeurs par défaut affichées.");
          setValues(defaultValues);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(id: string, value: boolean) {
    const previous = values;
    setValues((prev) => (prev ? { ...prev, [id]: value } : prev));
    setSavingId(id);
    setError(null);
    try {
      await updateNotificationPrefs({ [id]: value });
    } catch (err) {
      setValues(previous ?? null); // annule le changement optimiste en cas d'échec
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer, réessaie.");
    } finally {
      setSavingId(null);
    }
  }

  if (!values) {
    return <p className="text-center text-sm text-gray-500">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {notificationPrefGroups.map((group) => (
        <div key={group.title} className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-200">{group.title}</h2>
          <div className="flex flex-col divide-y divide-white/5">
            {group.prefs.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-white">{pref.label}</p>
                  <p className="text-xs text-gray-500">{pref.description}</p>
                  {pref.locked ? (
                    <p className="mt-0.5 text-xs text-gray-600">
                      🔒 Notification essentielle, non désactivable
                    </p>
                  ) : null}
                </div>
                <ToggleSwitch
                  label={pref.label}
                  checked={values[pref.id]}
                  disabled={pref.locked || savingId === pref.id}
                  onChange={(value) => handleChange(pref.id, value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
