"use client";

// Logo — mot-symbole "BilleTix" en capitales B/T, très gras ("Bille" ink
// adaptatif, "Tix" en corail de marque), accroche corail alignée à droite dessous, et
// icône de deux billets superposés qui chevauche la fin du mot (demande
// produit, style de la référence fournie — dessin propre à BilletiX).
// Bug corrigé : la première icône (étiquettes verticales à pointe) ne se
// lisait pas comme un billet — reprise en billets horizontaux à encoches
// latérales en demi-cercle + perforation du talon + étoile, codes visuels
// immédiatement reconnaissables d'un billet d'entrée.
// `useId()` : ids de mask uniques par instance, le logo pouvant apparaître
// plusieurs fois sur une même page.

import { useId } from "react";

export function Logo({ className = "" }: { className?: string }) {
  const id = useId();
  const backMask = `${id}-back`;
  const frontMask = `${id}-front`;

  return (
    <span className={`inline-flex items-start ${className}`} aria-label="BilleTix">
      <span className="flex flex-col items-end leading-none" aria-hidden="true">
        <span className="text-[24px] font-black tracking-[-0.05em] text-ink-1 sm:text-[30px]">
          Bille<span className="text-brand">Tix</span>
        </span>
        <span className="-mt-0.5 pr-0.5 text-[9px] font-semibold tracking-tight text-brand sm:text-[10px]">
          Simple &amp; sûr !
        </span>
      </span>
      <svg
        width="50"
        height="39"
        viewBox="0 0 44 34"
        fill="none"
        aria-hidden="true"
        className="-ml-1 -mt-2 h-[31px] w-[40px] shrink-0 sm:-mt-2.5 sm:h-[39px] sm:w-[50px]"
      >
        <defs>
          {/* Encoches en demi-cercle aux deux extrémités de chaque billet. */}
          <mask id={backMask}>
            <rect x="-10" y="-10" width="64" height="54" fill="white" />
            <circle cx="9" cy="12.5" r="3" fill="black" />
            <circle cx="37" cy="12.5" r="3" fill="black" />
          </mask>
          <mask id={frontMask}>
            <rect x="-10" y="-10" width="64" height="54" fill="white" />
            <circle cx="5" cy="20" r="3.2" fill="black" />
            <circle cx="35" cy="20" r="3.2" fill="black" />
          </mask>
        </defs>

        {/* Billet arrière, incliné vers la droite, teinte claire. */}
        <g transform="rotate(12 22 14)">
          <rect x="9" y="5" width="28" height="15" rx="2.1" fill="#f4a07f" mask={`url(#${backMask})`} />
        </g>

        {/* Billet avant, incliné vers la gauche : étoile + perforation du talon. */}
        <g transform="rotate(-10 20 20)">
          <rect x="5" y="12" width="30" height="16" rx="2.2" className="fill-brand" mask={`url(#${frontMask})`} />
          <polygon
            points="16,16 16.94,18.71 19.8,18.76 17.52,20.49 18.35,23.24 16,21.6 13.65,23.24 14.48,20.49 12.2,18.76 15.06,18.71"
            fill="white"
          />
          <line
            x1="27"
            y1="14.9"
            x2="27"
            y2="25.1"
            stroke="white"
            strokeWidth="1.1"
            strokeDasharray="1.6 1.45"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
