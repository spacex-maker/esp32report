import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Play, X } from "lucide-react";
import { SNIPPETS, type Snippet } from "../snippets/catalog";

type Props = {
  disabled: boolean;
  selected: Snippet | null;
  onSelect: (snippet: Snippet) => void;
  onRun: (snippet: Snippet) => void;
};

const tags = Array.from(new Set(SNIPPETS.map((s) => s.tag)));

export function SnippetGallery({ disabled, selected, onSelect, onRun }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pick(s: Snippet, run: boolean) {
    onSelect(s);
    setOpen(false);
    if (run) onRun(s);
  }

  return (
    <>
      <section className="panel p-5 animate-fade-up" style={{ animationDelay: "90ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink-900">代码片段</h2>
            <p className="mt-1 text-sm text-ink-700/75">默认收起，从库中选一条后仅显示当前选中项。</p>
          </div>
          <button type="button" className="btn-secondary shrink-0" onClick={() => setOpen(true)}>
            <BookOpen className="h-4 w-4" />
            打开片段库
          </button>
        </div>

        {selected ? (
          <div className="mt-4 rounded-xl border border-board-200 bg-board-50/70 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-board-700">
                  {selected.tag}
                </div>
                <div className="mt-0.5 font-medium text-ink-900">{selected.title}</div>
                <p className="mt-0.5 text-xs text-ink-700/70">{selected.blurb}</p>
              </div>
              <button
                type="button"
                className="btn-primary !px-2.5 !py-1.5 text-xs"
                disabled={disabled}
                onClick={() => onRun(selected)}
              >
                <Play className="h-3.5 w-3.5" />
                运行
              </button>
            </div>
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[12px] text-ink-50 whitespace-pre-wrap">
              {selected.code}
            </pre>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-6 text-center text-sm text-ink-700/70">
            尚未选择片段，点击「打开片段库」
          </p>
        )}
      </section>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-ink-900/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
              role="presentation"
              onClick={(ev) => {
                if (ev.target === ev.currentTarget) setOpen(false);
              }}
            >
              <div
                className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-ink-200 bg-[#f7f9fa] shadow-2xl sm:rounded-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 sm:px-5">
                  <div>
                    <h2 id={titleId} className="font-display text-lg font-semibold text-ink-900">
                      代码片段库
                    </h2>
                    <p className="text-xs text-ink-700/65">选择后载入到编辑区；可直接运行。</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1.5"
                    aria-label="关闭"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                  {tags.map((tag) => (
                    <div key={tag}>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-board-700">
                        {tag}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {SNIPPETS.filter((s) => s.tag === tag).map((s) => {
                          const active = selected?.id === s.id;
                          return (
                            <div
                              key={s.id}
                              className={`rounded-xl border px-3 py-3 transition ${
                                active
                                  ? "border-board-500 bg-board-50"
                                  : "border-ink-200 bg-white hover:border-board-300"
                              }`}
                            >
                              <div className="font-medium text-ink-900">{s.title}</div>
                              <p className="mt-0.5 text-xs text-ink-700/70">{s.blurb}</p>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  className="btn-secondary !px-2.5 !py-1 text-xs"
                                  onClick={() => pick(s, false)}
                                >
                                  选中
                                </button>
                                <button
                                  type="button"
                                  className="btn-primary !px-2.5 !py-1 text-xs"
                                  disabled={disabled}
                                  onClick={() => pick(s, true)}
                                >
                                  运行
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
