"use client";

// Préférences de notification persistées dans user-service.

import { useEffect, useState } from "react";
import { ToggleSwitch } from "@/components/profile/toggle-switch";
import { notificationPrefGroups } from "@/lib/constants/notification-prefs";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/api/notification-prefs";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";

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
          setError("Impossible de charger vos préférences, valeurs par défaut affichées.");
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
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer, veuillez réessayer.");
    } finally {
      setSavingId(null);
    }
  }

  if (!values) {
    return <MutedMessage />;
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert>
          {error}
        </Alert>
      ) : null}

      {notificationPrefGroups.map((group) => (
        <div key={group.title} className={cardClass("p-5")}>
          <h2 className="mb-3 text-sm font-semibold text-ink-2">{group.title}</h2>
          <div className="flex flex-col divide-y divide-hairline-1">
            {group.prefs.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-ink-1">{pref.label}</p>
                  <p className="text-xs text-ink-5">{pref.description}</p>
                  {pref.locked ? (
                    <p className="mt-0.5 text-xs text-ink-6">
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
