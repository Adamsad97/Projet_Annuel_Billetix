import { checkoutSteps, type CheckoutStepId } from "@/lib/mock/checkout";

export function CheckoutStepper({
  current,
}: {
  current: CheckoutStepId;
}) {
  const currentIndex = checkoutSteps.findIndex((step) => step.id === current);

  return (
    <ol className="mx-auto flex max-w-3xl items-center">
      {checkoutSteps.map((step, index) => {
        const isLast = index === checkoutSteps.length - 1;
        // La dernière étape (Confirmation) n'a pas d'étape suivante : y
        // arriver signifie que tout le parcours est terminé, donc elle
        // doit s'afficher comme "terminée" (✓ vert), pas "en cours".
        const isDone = index < currentIndex || (isLast && index === currentIndex);
        const isCurrent = index === currentIndex && !isDone;

        return (
          <li key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={
                  isDone
                    ? "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white"
                    : isCurrent
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white ring-4 ring-violet-500/25"
                      : "flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-gray-400"
                }
              >
                {isDone ? "✓" : index + 1}
              </div>
              <span
                className={
                  isCurrent
                    ? "text-xs font-medium text-violet-300"
                    : isDone
                      ? "text-xs font-medium text-gray-300"
                      : "text-xs font-medium text-gray-500"
                }
              >
                {step.label}
              </span>
            </div>

            {!isLast ? (
              <div
                className={
                  isDone
                    ? "mx-2 h-0.5 flex-1 bg-emerald-500"
                    : "mx-2 h-0.5 flex-1 bg-white/10"
                }
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
