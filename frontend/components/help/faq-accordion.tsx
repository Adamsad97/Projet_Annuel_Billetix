"use client";

import { useState } from "react";
import type { FaqCategory } from "@/lib/mock/faq";

export function FaqAccordion({ category }: { category: FaqCategory }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#12101c]">
      <h2 className="flex items-center gap-2 border-b border-white/5 px-5 py-4 text-sm font-semibold text-gray-200">
        <span>{category.emoji}</span>
        {category.title}
      </h2>

      <div>
        {category.items.map((item, index) => {
          const isOpen = index === openIndex;
          return (
            <div key={item.question} className="border-b border-white/5 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white"
              >
                {item.question}
                <span className={isOpen ? "text-violet-400" : "text-gray-500"}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen ? (
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-400">
                  {item.answer}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
