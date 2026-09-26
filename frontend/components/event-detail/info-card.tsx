import type { ReactNode } from "react";

export function InfoCard({
  icon,
  title,
  titleClassName,
  children,
}: {
  icon: ReactNode;
  title: string;
  titleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline-1 bg-card p-5">
      <h2
        className={`mb-3 flex items-center gap-2 text-sm font-semibold ${titleClassName ?? "text-ink-2"}`}
      >
        <span className="flex items-center">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}
