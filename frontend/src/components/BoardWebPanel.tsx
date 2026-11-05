import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

export function BoardWebPanel() {
  const [ip, setIp] = useState("192.168.4.1");

  const href = useMemo(() => {
    const trimmed = ip.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
  }, [ip]);

  return (
    <section className="panel p-5 animate-fade-up" style={{ animationDelay: "240ms" }}>
      <h2 className="font-display text-lg font-semibold text-ink-900">板子 Web 面板</h2>
      <p className="mt-1 text-sm text-ink-700/75">
        若 MicroPython 已开 AP / HTTP 服务，可在此打开板子页面（与 Web Serial 无关）。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="field max-w-xs font-mono"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.4.1"
        />
        <a
          className={`btn-secondary ${!href ? "pointer-events-none opacity-45" : ""}`}
          href={href ?? "#"}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
          打开
        </a>
      </div>
    </section>
  );
}
