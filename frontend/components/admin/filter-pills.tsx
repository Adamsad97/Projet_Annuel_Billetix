"use client";

export function FilterPills({
  options,
  active,
  onChange,
}: {
  options: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={
              isActive
                ? "rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-hairline-1 px-3.5 py-1.5 text-sm font-medium text-ink-3 ring-1 ring-inset ring-hairline-2 transition-colors hover:bg-hairline-2 hover:text-ink-1"
            }
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="ml-1.5 opacity-70">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
