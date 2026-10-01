"use client";

// Modification câblée sur GET /events/:id/dashboard et PATCH /events/:id ; composant client (jeton du navigateur).

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthHeader } from "@/components/layout/auth-header";
import { EditEventForm } from "@/components/create-event/edit-event-form";
import { getEventDashboardDetail } from "@/lib/api/events";
import { listCategories, type ApiCategory } from "@/lib/api/categories";
import type { ApiEvent } from "@/lib/api/events";
import { ApiError } from "@/lib/api/http-error";
import { MutedMessage } from "@/components/ui/muted-message";
import { t } from "@/lib/i18n/translate";

export default function ModifierEvenementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<ApiEvent | null | undefined>(undefined);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEventDashboardDetail(id), listCategories().catch(() => [])])
      .then(([detail, categoriesResult]) => {
        setEvent(detail.event);
        setCategories(categoriesResult);
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setEvent(null);
          return;
        }
        setError(err instanceof ApiError ? err.message : t("Impossible de charger cet événement."));
      });
  }, [id]);

  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />

      <main className="flex-1 px-6 py-10">
        <Link
          href={`/dashboard/evenements/${id}`}
          className="mx-auto mb-6 flex w-full max-w-2xl items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover"
        >{t("← Retour à l'événement")}</Link>

        <div className="mx-auto mb-10 w-full max-w-2xl text-center">
          <h1 className="text-2xl font-bold text-ink-1">{t("Modifier l'événement")}</h1>
        </div>

        {error ? (
          <div className="mx-auto mb-6 w-full max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-center text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {event === undefined ? (
          <MutedMessage />
        ) : event === null ? (
          <MutedMessage>{t("Cet événement n'existe pas ou n'appartient pas à votre compte.")}</MutedMessage>
        ) : (
          <EditEventForm event={event} categories={categories} />
        )}
      </main>
    </div>
  );
}
