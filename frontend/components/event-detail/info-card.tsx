import type { ReactNode } from "react";

export function InfoCard({
  icon,
  title,
  titleClassName,
  children,
}: {
  icon: string;
  title: string;
  titleClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c] p-5">
      <h2
        className={`mb-3 flex items-center gap-2 text-sm font-semibold ${titleClassName ?? "text-gray-200"}`}
      >
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}
