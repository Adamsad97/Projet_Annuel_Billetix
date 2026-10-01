"use client";

import type { ReactNode } from "react";
import { cardClass } from "@/components/ui/card";
import { t } from "@/lib/i18n/translate";

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
    <div className={cardClass("p-5")}>
      <h2
        className={`mb-3 flex items-center gap-2 text-sm font-semibold ${titleClassName ?? "text-ink-2"}`}
      >
        <span className="flex items-center">{icon}</span>
        {t(title)}
      </h2>
      {children}
    </div>
  );
}
