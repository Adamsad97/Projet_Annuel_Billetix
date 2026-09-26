import Link from "next/link";
import { adminNavSections } from "@/lib/mock/admin";

export function AdminSidebar({ active = "/admin" }: { active?: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-hairline-1 px-3 py-6">
      <nav className="flex flex-col gap-6">
        {adminNavSections.map((section) => (
          <div key={section.id}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-6">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.href === active;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={
                      isActive
                        ? "flex items-center justify-between rounded-lg bg-blue-600/20 px-3 py-2 text-sm font-medium text-accent ring-1 ring-inset ring-blue-500/30"
                        : "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink-4 transition-colors hover:bg-hairline-1 hover:text-ink-2"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      {item.label}
                    </span>
                    {item.badge ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
