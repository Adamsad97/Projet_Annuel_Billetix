// Console de contrôle d'accès : le scan des QR codes par la caméra n'est pas
// encore disponible dans le navigateur (aucune simulation affichée).

export function ScanConsole() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-link">Contrôle d&apos;accès</p>
        <h1 className="text-xl font-bold text-ink-1">Scan des billets</h1>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-hairline-1 bg-card px-6 py-12">
        <span className="text-4xl" aria-hidden="true">
          📷
        </span>
        <p className="text-sm font-medium text-ink-2">Le scan des billets n&apos;est pas encore disponible sur cette page.</p>
        <p className="text-xs text-ink-5">Il sera activé prochainement pour les agents de contrôle et les organisateurs.</p>
      </div>
    </div>
  );
}
