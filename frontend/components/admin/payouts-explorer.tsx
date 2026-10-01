"use client";

// Reversements : recherche, filtres et tri côté serveur (GET /admin/payouts), actions bloquer, débloquer, anticiper.

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { PayoutRow } from "@/components/admin/payout-row";
import { ActionDialog, type ActionDialogState } from "@/components/ui/action-dialog";
import { FilterMenu, FilterOption } from "@/components/ui/filter-menu";
import { SearchField } from "@/components/ui/search-field";
import {
  approveEarlyPayout,
  blockPayout,
  listPayouts,
  unblockPayout,
  type AdminPayoutSort,
  type ApiPayout,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { Alert } from "@/components/ui/alert";
import { MutedMessage } from "@/components/ui/muted-message";
import { cardClass } from "@/components/ui/card";
import { filterSelectClass } from "@/components/ui/field";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { t, msg } from "@/lib/i18n/translate";

const statusFilters: { id: string; label: string }[] = [
  { id: "all", label: msg("Tous") },
  { id: "PENDING", label: msg("En attente") },
  { id: "PROCESSING", label: msg("En cours") },
  { id: "TO_TRANSFER", label: msg("À virer") },
  { id: "COMPLETED", label: msg("Versés") },
  { id: "BLOCKED", label: msg("Bloqués") },
  { id: "FAILED", label: msg("Échoués") },
];

const PAGE_SIZE = 50;

type Period = "" | "upcoming" | "this_month" | "last_month" | "last_3_months";

const periodOptions: { id: Period; label: string }[] = [
  { id: "", label: msg("Toutes les échéances") },
  { id: "upcoming", label: msg("À venir") },
  { id: "this_month", label: msg("Ce mois-ci") },
  { id: "last_month", label: msg("Le mois dernier") },
  { id: "last_3_months", label: msg("Les 3 derniers mois") },
];

const sortOptions: { id: AdminPayoutSort; label: string }[] = [
  { id: "scheduled_desc", label: msg("Échéance la plus récente") },
  { id: "scheduled_asc", label: msg("Échéance la plus ancienne") },
  { id: "amount_desc", label: msg("Montant net le plus élevé") },
];

/** Bornes de l'échéance pour une période (heure locale). */
function periodRange(period: Period): { scheduled_from?: string; scheduled_to?: string } {
  const now = new Date();
  const monthStart = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  switch (period) {
    case "upcoming":
      return { scheduled_from: now.toISOString() };
    case "this_month":
      return { scheduled_from: monthStart(0).toISOString(), scheduled_to: new Date(monthStart(1).getTime() - 1).toISOString() };
    case "last_month":
      return { scheduled_from: monthStart(-1).toISOString(), scheduled_to: new Date(monthStart(0).getTime() - 1).toISOString() };
    case "last_3_months":
      return { scheduled_from: monthStart(-2).toISOString(), scheduled_to: now.toISOString() };
    default:
      return {};
  }
}

export function PayoutsExplorer() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("");
  const [sort, setSort] = useState<AdminPayoutSort>("scheduled_desc");
  const [loadingMore, setLoadingMore] = useState(false);
  const [payouts, setPayouts] = useState<ApiPayout[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogState | null>(null);

  const query = (offset: number, limit: number) =>
    listPayouts({
      status: status === "all" ? undefined : status,
      q: search.trim() || undefined,
      ...periodRange(period),
      sort,
      limit,
      offset,
    });

  function showPage(offset: number, limit: number, append: boolean) {
    return query(offset, limit)
      .then((result) => {
        setPayouts((current) => (append && current ? [...current, ...result.data] : result.data));
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t("Impossible de charger les reversements.")));
  }

  // Après une action : recharge en gardant le nombre de lignes déjà affichées.
  function load() {
    showPage(0, Math.max(PAGE_SIZE, payouts?.length ?? 0), false);
  }

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => showPage(0, PAGE_SIZE, false), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, period, sort]);

  async function loadMore() {
    if (!payouts) return;
    setLoadingMore(true);
    await showPage(payouts.length, PAGE_SIZE, true);
    setLoadingMore(false);
  }

  const hasFilters = status !== "all" || search.trim() !== "" || period !== "";
  function reset() {
    setStatus("all");
    setSearch("");
    setPeriod("");
  }

  function handleBlock(payout: ApiPayout) {
    setDialog({
      title: t("Bloquer le reversement de {organizer_name} ?", { organizer_name: payout.organizer_name }),
      message: t("Le versement ne sera pas déclenché tant que le blocage n'est pas levé."),
      confirmLabel: t("Bloquer"),
      danger: true,
      showReason: true,
      reasonRequired: true,
      reasonPlaceholder: t("Motif du blocage…"),
      onConfirm: async (reason) => {
        setBusyId(payout.id);
        try {
          await blockPayout(payout.id, reason!);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible de bloquer ce reversement."));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleUnblock(payout: ApiPayout) {
    setDialog({
      title: t("Débloquer ce reversement ?"),
      message: t("Il reprendra son cours normal (versé au prochain passage automatique)."),
      confirmLabel: t("Débloquer"),
      onConfirm: async () => {
        setBusyId(payout.id);
        try {
          await unblockPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible de débloquer ce reversement."));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleApproveEarly(payout: ApiPayout) {
    setDialog({
      title: t("Approuver la demande de reversement anticipé ?"),
      message: t("{organizer_name} sera versé sans attendre l'échéance normale.", { organizer_name: payout.organizer_name }),
      confirmLabel: t("Approuver"),
      onConfirm: async () => {
        setBusyId(payout.id);
        try {
          await approveEarlyPayout(payout.id);
          load();
        } catch (err) {
          setError(err instanceof ApiError ? err.message : t("Impossible d'approuver cette demande."));
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("Organisateur ou événement…")}
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label={t("Échéance")}
            value={periodOptions.find((option) => option.id === period)?.label}
            active={period !== ""}
            align="right"
          >
            {(close) => (
              <div role="menu">
                {periodOptions.map((option) => (
                  <FilterOption
                    key={option.id}
                    selected={period === option.id}
                    onSelect={() => {
                      setPeriod(option.id);
                      close();
                    }}
                  >
                    {t(option.label)}
                  </FilterOption>
                ))}
              </div>
            )}
          </FilterMenu>
          <label className="flex items-center gap-2 text-sm text-ink-5">
            <span className="sr-only">{t("Trier par")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as AdminPayoutSort)}
              className={filterSelectClass}
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={statusFilters} active={status} onChange={setStatus} />
        {hasFilters ? (
          <button type="button" onClick={reset} className="text-sm font-medium text-link hover:text-link-hover">{t("Réinitialiser")}</button>
        ) : null}
      </div>

      {payouts ? (
        <p className="text-sm text-ink-5" role="status">
          {total > 1 ? t("{count} reversements", { count: total }) : t("{count} reversement", { count: total })}
        </p>
      ) : null}

      {error ? (
        <Alert>{error}</Alert>
      ) : null}

      <div className={cardClass("overflow-hidden")}>
        {payouts === null ? (
          <MutedMessage variant="list" />
        ) : payouts.length > 0 ? (
          payouts.map((payout) => (
            <PayoutRow
              key={payout.id}
              payout={payout}
              busy={busyId === payout.id}
              onBlock={() => handleBlock(payout)}
              onUnblock={() => handleUnblock(payout)}
              onApproveEarly={() => handleApproveEarly(payout)}
            />
          ))
        ) : (
          <MutedMessage variant="list">{t("Aucun reversement ne correspond à ces critères.")}</MutedMessage>
        )}
      </div>

      {payouts && payouts.length < total ? (
        <LoadMoreButton onClick={loadMore} loading={loadingMore} remaining={total - payouts.length} />
      ) : null}

      <ActionDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
