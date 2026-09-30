"use client";

// Deux cases liées « Payant » / « Gratuit » : cocher ou décocher l'une
// bascule l'autre. Partagé par la création et la modification d'un événement.

export function TicketingTypeToggle({ free, onChange }: { free: boolean; onChange: (free: boolean) => void }) {
  return (
    <div role="group" aria-label="Type d'entrée" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(
        [
          { free: false, label: "Payant", description: "Les participants achètent leur billet." },
          { free: true, label: "Gratuit", description: "Entrée libre, sur réservation." },
        ] as const
      ).map((option) => {
        const checked = option.free === free;
        return (
          <label
            key={option.label}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              checked
                ? option.free
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-blue-500/50 bg-blue-500/10"
                : "border-hairline-2 bg-hairline-1 hover:border-hairline-4"
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(!free)}
              className={`mt-0.5 h-4 w-4 ${option.free ? "accent-emerald-600" : "accent-blue-600"}`}
            />
            <span>
              <span className="block text-sm font-semibold text-ink-1">{option.label}</span>
              <span className="block text-xs text-ink-5">{option.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
