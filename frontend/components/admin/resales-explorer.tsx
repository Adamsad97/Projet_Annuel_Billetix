"use client";

// Reventes de billets — données réelles (tickets.ticket_resales). La liste
// n'affiche qu'un résumé (date, billet, événement, statut) : le détail
// (vendeur, acheteur, prix, dates) ne s'ouvre qu'à la demande, via « Consulter ».

import { useEffect, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { SearchInput } from "@/components/admin/search-input";
import { DetailDialog, DetailSection } from "@/components/ui/detail-dialog";
import { listResales, type ApiAdminResale } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/http-error";
import { resaleStatusBadge } from "@/lib/mappers/resale-mappers";

const PAGE_SIZE = 20;
const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const statusFilters = [
  { id: "all", label: "Toutes" },
  { id: "LISTED", label: "En vente" },
  { id: "RESERVED", label: "Paiement en cours" },
  { id: "SOLD", label: "Vendues" },
  { id: "WITHDRAWN", label: "Retirées" },
  { id: "EXPIRED", label: "Expirées" },
];

function Account({ account }: { account: ApiAdminResale["seller"] }) {
  if (!account) return <span className="text-ink-5">—</span>;
  return (
    <>
      <p className="text-ink-1">
        {account.first_name} {account.last_name}
      </p>
      <p className="text-xs text-ink-5">{account.email}</p>
    </>
  );
}

export function ResalesExplorer() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [resales, setResales] = useState<ApiAdminResale[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiAdminResale | null>(null);

  // Recherche différée (300ms) pour éviter une requête à chaque frappe.
  useEffect(() => {
    const timeout = setTimeout(() => {
      listResales({ status: status === "all" ? undefined : status, q: search.trim() || undefined, page, limit: PAGE_SIZE })
        .then((result) => {
          setResales(result.data);
          setTotal(result.total);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les reventes."));
    }, 300);
    return () => clearTimeout(timeout);
  }, [status, search, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          options={statusFilters}
          active={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Référence, événement ou email d'un compte…"
        />
      </div>
      <p className="text-sm text-ink-5">
        {total} annonce{total > 1 ? "s" : ""}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-hairline-1 bg-card">
        {resales === null ? (
          <p className="px-5 py-4 text-sm text-ink-5">{error ?? "Chargement…"}</p>
        ) : resales.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-5">Aucune revente.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline-1 text-xs uppercase tracking-wide text-ink-5">
              <tr>
                <th className="px-5 py-3 font-semibold">Mise en vente</th>
                <th className="px-5 py-3 font-semibold">Billet</th>
                <th className="px-5 py-3 font-semibold">Événement</th>
                <th className="px-5 py-3 font-semibold">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {resales.map((resale) => {
                const badge = resaleStatusBadge[resale.status];
                return (
                  <tr key={resale.id} className="border-b border-hairline-1 last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3 text-ink-3">{dateTimeFormatter.format(new Date(resale.listed_at))}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-ink-1">{resale.ticket_reference ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-3">{resale.event_name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(resale)}
                        className="whitespace-nowrap rounded-lg bg-hairline-1 px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2"
                      >
                        Consulter
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-ink-5">
            Page {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full border border-hairline-3 px-4 py-1.5 text-ink-3 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      ) : null}

      <DetailDialog
        open={selected !== null}
        title={selected ? `Revente du billet ${selected.ticket_reference ?? ""}` : ""}
        subtitle={selected ? [selected.event_name, selected.ticket_category_name].filter(Boolean).join(" · ") : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <DetailSection title="Statut">
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${resaleStatusBadge[selected.status].className}`}
              >
                {resaleStatusBadge[selected.status].label}
              </span>
              <p className="mt-2 text-ink-4">Mis en vente le {dateTimeFormatter.format(new Date(selected.listed_at))}</p>
              {selected.sold_at ? <p className="text-ink-4">Vendu le {dateTimeFormatter.format(new Date(selected.sold_at))}</p> : null}
              {selected.status === "RESERVED" && selected.reservation_expires_at ? (
                <p className="text-ink-4">
                  Paiement en cours, réservation jusqu&apos;au {dateTimeFormatter.format(new Date(selected.reservation_expires_at))}
                </p>
              ) : null}
            </DetailSection>
            <DetailSection title="Prix">
              <p className="font-medium text-ink-1">{currency.format(Number(selected.resale_price))}</p>
              {selected.face_value !== null ? <p className="text-ink-4">Valeur faciale : {currency.format(selected.face_value)}</p> : null}
            </DetailSection>
            <DetailSection title="Vendeur">
              <Account account={selected.seller} />
            </DetailSection>
            <DetailSection title="Acheteur">
              <Account account={selected.buyer} />
            </DetailSection>
          </>
        ) : null}
      </DetailDialog>
    </div>
  );
}
