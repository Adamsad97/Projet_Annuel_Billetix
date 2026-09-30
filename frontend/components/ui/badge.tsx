// Pastille de statut. La couleur (tone) vient des constantes de statut
// (lib/constants/*), la forme est la même partout.

export function Badge({
  tone,
  size = "sm",
  className = "",
  children,
}: {
  /** Classes de couleur : fond, texte, éventuel contour. */
  tone: string;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 text-xs font-medium ${size === "sm" ? "py-0.5" : "py-1"} ${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}
