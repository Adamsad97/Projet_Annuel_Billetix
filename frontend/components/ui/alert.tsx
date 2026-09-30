// Encadrés de message : bandeau de page (Alert) et erreur de formulaire (FormError).

const TONES = {
  error: "border-red-500/20 bg-red-500/5 text-red-300",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-200",
  success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
} as const;

export function Alert({
  tone = "error",
  centered = false,
  className = "",
  children,
}: {
  tone?: keyof typeof TONES;
  /** Message seul à la place du contenu (chargement échoué). */
  centered?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-5 text-sm ${TONES[tone]} ${centered ? "py-6 text-center" : "py-4"} ${className}`}
    >
      {children}
    </div>
  );
}

export function FormError({ className = "mb-4", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="alert" className={`rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-500/30 ${className}`}>
      {children}
    </div>
  );
}
