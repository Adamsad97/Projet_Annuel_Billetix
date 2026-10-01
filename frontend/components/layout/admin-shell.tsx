import type { ReactNode } from "react";
import { AuthHeader } from "@/components/layout/auth-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-page">
      <AuthHeader />
      {/* Colonne sur grand écran, menu dépliable au-dessus du contenu sinon.
          min-w-0 : un tableau large défile dans son cadre au lieu d'élargir la page. */}
      <div className="flex flex-1 flex-col lg:flex-row">
        <AdminSidebar active={active} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
