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
                ? "rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white"
                : "rounded-full bg-white/5 px-3.5 py-1.5 text-sm font-medium text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
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
