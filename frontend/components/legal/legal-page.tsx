import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/navbar";

export function LegalPage({
  title,
  updatedLabel,
  children,
}: {
  title: string;
  updatedLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">Dernière mise à jour : {updatedLabel}</p>

        <div className="prose-legal mt-8 flex flex-col gap-6 text-sm leading-relaxed text-gray-400">
          {children}
        </div>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-white">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
