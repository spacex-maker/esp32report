import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export type SelectOption<T extends string | number = string> = {
  value: T;
  label: string;
  hint?: string;
};

type Props<T extends string | number> = {
  id?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function SelectMenu<T extends string | number>({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
  placeholder = "请选择",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={clsx(
          "flex w-full items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-left text-sm outline-none transition",
          "border-ink-200 hover:border-board-300",
          "focus:border-board-400 focus:ring-2 focus:ring-board-200",
          open && "border-board-400 ring-2 ring-board-200",
          disabled && "cursor-not-allowed opacity-45",
        )}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate font-medium", selected ? "text-ink-900" : "text-ink-700/50")}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.hint ? (
            <span className="mt-0.5 block truncate text-xs text-ink-700/55">{selected.hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-ink-700/55 transition-transform duration-200",
            open && "rotate-180 text-board-600",
          )}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-ink-200/90 bg-white py-1 shadow-[0_12px_40px_-12px_rgba(18,22,29,0.35)]"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={String(opt.value)} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={clsx(
                    "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition",
                    active ? "bg-board-50 text-board-800" : "text-ink-800 hover:bg-ink-50",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{opt.label}</span>
                    {opt.hint ? <span className="mt-0.5 block text-xs text-ink-700/55">{opt.hint}</span> : null}
                  </span>
                  {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-board-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
