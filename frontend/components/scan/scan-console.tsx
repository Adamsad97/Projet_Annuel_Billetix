"use client";

import { useRef, useState } from "react";
import {
  currentScanEvent,
  knownTickets,
  scanOutcomeStyles,
  type ScanOutcome,
} from "@/lib/mock/scan";

interface ScanRecord {
  id: string;
  reference: string;
  holderName: string;
  category: string;
  outcome: ScanOutcome;
  timeLabel: string;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ScanConsole() {
  const [manualCode, setManualCode] = useState("");
  const [current, setCurrent] = useState<ScanRecord | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const cursorRef = useRef(0);

  function record(reference: string, holderName: string, category: string, outcome: ScanOutcome) {
    const entry: ScanRecord = {
      id: `${reference}-${Date.now()}`,
      reference,
      holderName,
      category,
      outcome,
      timeLabel: nowLabel(),
    };
    setCurrent(entry);
    setHistory((prev) => [entry, ...prev].slice(0, 5));
  }

  function simulateScan() {
    const ticket = knownTickets[cursorRef.current % knownTickets.length];
    cursorRef.current += 1;
    record(ticket.reference, ticket.holderName, ticket.category, ticket.outcome);
  }

  function verifyManualCode() {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    const ticket = knownTickets.find((t) => t.reference.toUpperCase() === code);
    if (ticket) {
      record(ticket.reference, ticket.holderName, ticket.category, ticket.outcome);
    } else {
      record(code, "—", "—", "invalid");
    }
    setManualCode("");
  }

  const style = current ? scanOutcomeStyles[current.outcome] : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Contrôle d&apos;accès
        </p>
        <h1 className="text-xl font-bold text-white">{currentScanEvent.name}</h1>
        <p className="text-sm text-gray-500">{currentScanEvent.dateLabel}</p>
      </div>

      <button
        type="button"
        onClick={simulateScan}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] py-14 transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
      >
        <span className="text-4xl">📷</span>
        <span className="text-sm font-medium text-gray-400">
          Toucher pour scanner un QR code
        </span>
      </button>

      {current && style ? (
        <div className={`rounded-2xl px-5 py-4 ring-1 ring-inset ${style.className}`}>
          <div className="flex items-center gap-2 text-base font-bold">
            <span>{style.icon}</span>
            {style.label}
          </div>
          <p className="mt-1 text-sm opacity-90">
            {current.reference} · {current.holderName} · {current.category}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 text-center text-sm text-gray-500">
          En attente d&apos;un scan…
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && verifyManualCode()}
          placeholder="Saisie manuelle — TKT-2026-XXXXXX"
          className="w-full rounded-full border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={verifyManualCode}
          className="shrink-0 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Vérifier
        </button>
      </div>

      {history.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#12101c]">
          <p className="border-b border-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Derniers scans
          </p>
          {history.map((entry) => {
            const entryStyle = scanOutcomeStyles[entry.outcome];
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-b-0"
              >
                <div>
                  <p className="font-medium text-white">{entry.reference}</p>
                  <p className="text-xs text-gray-500">{entry.holderName}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entryStyle.className}`}>
                    {entryStyle.icon} {entryStyle.label}
                  </span>
                  <p className="mt-0.5 text-xs text-gray-600">{entry.timeLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
