import Link from "next/link";

// Lien de retour en tête de page (« ← Mes billets »).

export function BackLink({ href, children, className = "mb-6" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover ${className}`}
    >
      ← {children}
    </Link>
  );
}
