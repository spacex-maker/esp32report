import clsx from "clsx";
import { Cable, Unplug } from "lucide-react";

type Props = {
  serialOk: boolean;
  secureOk: boolean;
  connected: boolean;
  busy: boolean;
  portLabel: string | null;
  message: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function StatusBar({
  serialOk,
  secureOk,
  connected,
  busy,
  portLabel,
  message,
  onConnect,
  onDisconnect,
}: Props) {
  let statusText = "点击连接";
  let tone: "ok" | "warn" | "bad" | "idle" = "idle";

  if (!serialOk) {
    statusText = "Web Serial 不可用，请换 Chrome / Edge";
    tone = "bad";
  } else if (!secureOk) {
    statusText = "非安全上下文：请用 localhost 或 HTTPS";
    tone = "warn";
  } else if (connected) {
    statusText = portLabel ? `已连接 · ${portLabel}` : "已连接";
    tone = "ok";
  }

  return (
    <header className="panel sticky top-3 z-20 mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 animate-fade-up">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={clsx(
            "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
            tone === "ok" && "bg-board-500 animate-pulse-dot",
            tone === "warn" && "bg-copper-500",
            tone === "bad" && "bg-red-500",
            tone === "idle" && "bg-ink-200",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight text-ink-900">
            ESP32 浏览器控制台
          </div>
          <div className="truncate text-sm text-ink-700/80">{statusText}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!connected ? (
          <button
            type="button"
            className="btn-primary"
            disabled={!serialOk || !secureOk || busy}
            onClick={onConnect}
          >
            <Cable className="h-4 w-4" />
            连接
          </button>
        ) : (
          <button type="button" className="btn-danger" disabled={busy} onClick={onDisconnect}>
            <Unplug className="h-4 w-4" />
            断开
          </button>
        )}
      </div>

      {message ? (
        <p className="w-full rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">{message}</p>
      ) : null}
    </header>
  );
}
