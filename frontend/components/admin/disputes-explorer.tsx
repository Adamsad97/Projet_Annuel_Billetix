"use client";

import { useMemo, useState } from "react";
import { FilterPills } from "@/components/admin/filter-pills";
import { DisputeRow } from "@/components/admin/dispute-row";
import {
  adminDisputes,
  disputeStatusFilters,
  type DisputeStatus,
} from "@/lib/mock/admin-disputes";

export function DisputesExplorer() {
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    if (status === "all") return adminDisputes;
    return adminDisputes.filter((dispute) => dispute.status === (status as DisputeStatus));
  }, [status]);

  return (
    <div className="flex flex-col gap-5">
      <FilterPills options={disputeStatusFilters} active={status} onChange={setStatus} />

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
        {filtered.length > 0 ? (
          filtered.map((dispute) => <DisputeRow key={dispute.id} dispute={dispute} />)
        ) : (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            Aucun litige dans cette catégorie.
          </p>
        )}
      </div>
    </div>
  );
}
