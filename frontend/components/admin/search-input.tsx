"use client";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/10 bg-white/[0.02] py-2 pl-9 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  );
}
