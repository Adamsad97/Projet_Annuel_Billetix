"use client";

import { useId } from "react";
import type { Locale } from "@/lib/i18n/config";

/** Drapeau de la langue en SVG (les emojis de drapeaux ne s'affichent pas sous Windows) : France, Royaume-Uni. */
export function LocaleFlag({ locale, className = "" }: { locale: Locale; className?: string }) {
  const id = useId();
  const frame = `h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/15 ${className}`;

  if (locale === "fr") {
    return (
      <svg viewBox="0 0 3 2" className={frame} aria-hidden="true">
        <rect width="1" height="2" fill="#0055a4" />
        <rect x="1" width="1" height="2" fill="#ffffff" />
        <rect x="2" width="1" height="2" fill="#ef4135" />
      </svg>
    );
  }

  const clip = `${id}-diagonals`;
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className={frame} aria-hidden="true">
      <clipPath id={clip}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
