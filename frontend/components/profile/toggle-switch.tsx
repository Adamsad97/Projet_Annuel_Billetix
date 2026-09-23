"use client";

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        checked
          ? "relative h-6 w-11 shrink-0 rounded-full bg-violet-600 transition-colors disabled:opacity-40"
          : "relative h-6 w-11 shrink-0 rounded-full bg-white/10 transition-colors disabled:opacity-40"
      }
    >
      <span
        className={
          checked
            ? "absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            : "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        }
      />
    </button>
  );
}
