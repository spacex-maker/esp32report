import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Play, Square, RotateCcw, Download } from "lucide-react";
import type { MicroPythonRepl } from "../repl/microPythonRepl";

type Props = {
  connected: boolean;
  busy: boolean;
  repl: MicroPythonRepl | null;
  snippet: string;
  onSnippetChange: (code: string) => void;
  /** 外部递增时自动执行当前片段 */
  runRequestId?: number;
};

export function ReplTerminal({
  connected,
  busy,
  repl,
  snippet,
  onSnippetChange,
  runRequestId = 0,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const replRef = useRef<MicroPythonRepl | null>(null);
  const busyRef = useRef(busy);
  const logRef = useRef("");
  const [running, setRunning] = useState(false);
  const lastRunId = useRef(0);

  replRef.current = repl;
  busyRef.current = busy;

  useEffect(() => {
    if (!hostRef.current || termRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fontSize: 13,
      theme: {
        background: "#12161d",
        foreground: "#e8ecf1",
        cursor: "#4d968e",
        selectionBackground: "#2f7a72",
      },
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    term.writeln("\x1b[32mMicroPython REPL\x1b[0m — 连接后即可交互；Ctrl+C 中断，Ctrl+D 软重启。");
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    term.onData((data) => {
      const r = replRef.current;
      if (!r || busyRef.current) return;
      void r.writeUserInput(data);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!repl || !termRef.current) return;
    const term = termRef.current;
    repl.setPassthrough((chunk) => {
      term.write(chunk);
      logRef.current += new TextDecoder().decode(chunk);
    });
    return () => repl.setPassthrough(null);
  }, [repl]);

  useEffect(() => {
    fitRef.current?.fit();
  }, [connected]);

  async function runSnippet(code = snippet) {
    if (!repl) return;
    setRunning(true);
    const term = termRef.current;
    try {
      term?.writeln("\r\n\x1b[33m--- raw REPL ---\x1b[0m");
      const result = await repl.runRaw(code.replace(/\r\n/g, "\n"));
      if (result.stdout) {
        term?.write(result.stdout);
        logRef.current += result.stdout;
      }
      if (result.stderr) {
        term?.write(`\x1b[31m${result.stderr}\x1b[0m`);
        logRef.current += result.stderr;
      }
      term?.writeln("\x1b[33m--- end ---\x1b[0m");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      term?.writeln(`\x1b[31m${msg}\x1b[0m`);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (!runRequestId || runRequestId === lastRunId.current) return;
    lastRunId.current = runRequestId;
    if (connected && repl && !busy) {
      void runSnippet(snippet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequestId]);

  function exportLog() {
    const blob = new Blob([logRef.current || "(empty)"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `esp32-repl-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel p-5 animate-fade-up" style={{ animationDelay: "180ms" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">MicroPython REPL</h2>
          <p className="mt-1 text-sm text-ink-700/75">
            波特率 115200。可从上方片段库载入代码；终端内直接打字为友好 REPL。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={!connected || busy || !repl}
            onClick={() => void repl?.interrupt()}
          >
            <Square className="h-4 w-4" />
            Ctrl+C
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!connected || busy || !repl}
            onClick={() => void repl?.softReset()}
          >
            <RotateCcw className="h-4 w-4" />
            Ctrl+D
          </button>
          <button type="button" className="btn-secondary" onClick={exportLog}>
            <Download className="h-4 w-4" />
            导出日志
          </button>
        </div>
      </div>

      <div
        ref={hostRef}
        className={`h-72 overflow-hidden rounded-xl border border-ink-800 bg-ink-900 ${
          !connected ? "opacity-50" : ""
        }`}
      />

      <label className="label mt-4" htmlFor="snippet">
        代码片段（raw REPL）
      </label>
      <textarea
        id="snippet"
        className="field min-h-[120px] font-mono"
        value={snippet}
        onChange={(e) => onSnippetChange(e.target.value)}
        disabled={!connected || busy}
        spellCheck={false}
      />
      <button
        type="button"
        className="btn-primary mt-3"
        disabled={!connected || busy || running || !repl}
        onClick={() => void runSnippet()}
      >
        <Play className="h-4 w-4" />
        {running ? "执行中…" : "执行片段"}
      </button>
    </section>
  );
}
