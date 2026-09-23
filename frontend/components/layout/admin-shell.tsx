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
    <div className="flex flex-1 flex-col bg-[#07060c]">
      <AuthHeader />
      <div className="flex flex-1">
        <AdminSidebar active={active} />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
