// Pastille ronde aux initiales d'une personne (« AD » pour Adama Diawara).

const SIZES = {
  sm: "h-10 w-10 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-16 w-16 text-xl",
} as const;

export function initialsOf(firstName?: string | null, lastName?: string | null, fallback = "?"): string {
  const letters = `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}`.toUpperCase();
  return letters || fallback;
}

export function Avatar({
  firstName,
  lastName,
  size = "sm",
}: {
  firstName?: string | null;
  lastName?: string | null;
  size?: keyof typeof SIZES;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white ${SIZES[size]}`}
    >
      {initialsOf(firstName, lastName)}
    </div>
  );
}
