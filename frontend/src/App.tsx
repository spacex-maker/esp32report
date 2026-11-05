import { useCallback, useMemo, useRef, useState } from "react";
import { StatusBar } from "./components/StatusBar";
import { ChipInfoPanel } from "./components/ChipInfoPanel";
import { FlashPanel } from "./components/FlashPanel";
import { ReplTerminal } from "./components/ReplTerminal";
import { BoardWebPanel } from "./components/BoardWebPanel";
import { SnippetGallery } from "./components/SnippetGallery";
import { QuickTools } from "./components/QuickTools";
import { FsBrowser } from "./components/FsBrowser";
import {
  backupFlash,
  downloadBlob,
  flashFirmware,
  probeChipInfo,
  type ChipInfo,
} from "./esp/espTool";
import { MicroPythonRepl } from "./repl/microPythonRepl";
import { formatPortInfo, isSecureContextOk, isWebSerialSupported, mapSerialError } from "./serial/errors";
import { DEFAULT_BAUD, SerialPortSession } from "./serial/serialPort";
import { type Snippet } from "./snippets/catalog";

type Progress = { label: string; pct: number };

export default function App() {
  const serialOk = useMemo(() => isWebSerialSupported(), []);
  const secureOk = useMemo(() => isSecureContextOk(), []);

  const sessionRef = useRef(new SerialPortSession());
  const [connected, setConnected] = useState(false);
  const [portLabel, setPortLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyProbe, setBusyProbe] = useState(false);
  const [chipInfo, setChipInfo] = useState<ChipInfo | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [repl, setRepl] = useState<MicroPythonRepl | null>(null);
  const [snippet, setSnippet] = useState("print(1+1)\n");
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [runRequestId, setRunRequestId] = useState(0);

  const bindRepl = useCallback((session: SerialPortSession) => {
    const r = new MicroPythonRepl(session);
    r.attach();
    setRepl(r);
  }, []);

  const onConnect = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      const session = sessionRef.current;
      session.setDisconnectHandler(() => {
        setConnected(false);
        setPortLabel(null);
        setRepl(null);
        setMessage("设备已断开，请重新连接。");
      });
      await session.requestAndOpen(DEFAULT_BAUD);
      const info = session.getInfo();
      setPortLabel(info ? formatPortInfo(info) : "串口");
      setConnected(true);
      bindRepl(session);
      setMessage("已连接。可先试「轻量设备信息」或片段库。");
    } catch (err) {
      setMessage(mapSerialError(err));
      setConnected(false);
      setRepl(null);
    } finally {
      setBusy(false);
    }
  }, [bindRepl]);

  const onDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      setRepl(null);
      await sessionRef.current.close();
      setConnected(false);
      setPortLabel(null);
      setMessage("已断开。");
    } catch (err) {
      setMessage(mapSerialError(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const withEsptoolPort = useCallback(
    async <T,>(fn: (port: SerialPort) => Promise<T>): Promise<T> => {
      const session = sessionRef.current;
      if (!session.currentPort) {
        throw new Error("请先连接串口。");
      }
      setRepl(null);
      const port = await session.handoffForEsptool();
      try {
        const result = await fn(port);
        await session.reopenAfterEsptool(DEFAULT_BAUD);
        bindRepl(session);
        return result;
      } catch (err) {
        try {
          await session.reopenAfterEsptool(DEFAULT_BAUD);
          bindRepl(session);
        } catch {
          setConnected(false);
          setRepl(null);
        }
        throw err;
      }
    },
    [bindRepl],
  );

  const onProbe = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    setBusyProbe(true);
    try {
      const info = await withEsptoolPort((port) => probeChipInfo(port, DEFAULT_BAUD));
      setChipInfo(info);
      setMessage(`探测完成：${info.chipDescription}`);
    } catch (err) {
      setMessage(mapSerialError(err));
    } finally {
      setBusy(false);
      setBusyProbe(false);
      setProgress(null);
    }
  }, [withEsptoolPort]);

  const onCustomFlash = useCallback(
    async (file: File, address: number) => {
      setMessage(null);
      setBusy(true);
      setProgress({ label: "准备烧录…", pct: 0 });
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        await withEsptoolPort((port) =>
          flashFirmware(port, DEFAULT_BAUD, {
            data: buf,
            address,
            onProgress: (written, total, label) => {
              setProgress({
                label: label ?? "烧录",
                pct: total ? (written / total) * 100 : 0,
              });
            },
          }),
        );
        setMessage(`烧录完成：${file.name} → 0x${address.toString(16)}`);
      } catch (err) {
        setMessage(mapSerialError(err));
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [withEsptoolPort],
  );

  const onBackup = useCallback(
    async (sizeBytes: number) => {
      setMessage(null);
      setBusy(true);
      setProgress({ label: "整片备份…", pct: 0 });
      try {
        const blob = await withEsptoolPort((port) =>
          backupFlash(port, DEFAULT_BAUD, sizeBytes, (written, total, label) => {
            setProgress({
              label: label ?? "备份",
              pct: total ? (written / total) * 100 : 0,
            });
          }),
        );
        const name = `esp32-flash-backup-${sizeBytes / 1024 / 1024}MB-${Date.now()}.bin`;
        downloadBlob(blob, name);
        setMessage(`备份已下载：${name}（${(blob.size / 1024 / 1024).toFixed(2)} MB）`);
      } catch (err) {
        setMessage(mapSerialError(err));
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [withEsptoolPort],
  );

  const onBeforeWebTools = useCallback(async () => {
    if (connected) {
      setMessage("即将使用 esp-web-tools：请先在弹窗中选择串口。若失败，请先点「断开」再重试。");
      try {
        setRepl(null);
        await sessionRef.current.close();
        setConnected(false);
        setPortLabel(null);
      } catch {
        /* ignore */
      }
    }
  }, [connected]);

  const loadSnippet = useCallback((s: Snippet) => {
    setSelectedSnippet(s);
    setSnippet(s.code);
    setMessage(`已选中片段：${s.title}`);
  }, []);

  const runSnippetNow = useCallback((s: Snippet) => {
    setSelectedSnippet(s);
    setSnippet(s.code);
    setRunRequestId((n) => n + 1);
    setMessage(`正在运行：${s.title}`);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-3">
      <StatusBar
        serialOk={serialOk}
        secureOk={secureOk}
        connected={connected}
        busy={busy}
        portLabel={portLabel}
        message={message}
        onConnect={() => void onConnect()}
        onDisconnect={() => void onDisconnect()}
      />

      {!serialOk ? (
        <div className="panel mt-4 border-red-200 bg-red-50/80 p-5 text-red-800">
          <h2 className="font-display text-lg font-semibold">请使用 Chrome / Edge</h2>
          <p className="mt-2 text-sm">
            本应用依赖 Web Serial API，Firefox / Safari 无法完整工作。请在 Chromium 内核浏览器中打开
            <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs">http://127.0.0.1:5173</code>
            。
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <QuickTools
          connected={connected}
          busy={busy}
          repl={repl}
          chipInfo={chipInfo}
          onMessage={setMessage}
        />
        <ChipInfoPanel
          info={chipInfo}
          busy={busyProbe}
          disabled={!connected || busy}
          onProbe={() => void onProbe()}
        />
      </div>

      <div className="mt-4">
        <SnippetGallery
          disabled={!connected || busy || !repl}
          selected={selectedSnippet}
          onSelect={loadSnippet}
          onRun={runSnippetNow}
        />
      </div>

      <div className="mt-4">
        <ReplTerminal
          connected={connected}
          busy={busy}
          repl={repl}
          snippet={snippet}
          onSnippetChange={setSnippet}
          runRequestId={runRequestId}
        />
      </div>

      <div className="mt-4">
        <FsBrowser connected={connected} busy={busy} repl={repl} onMessage={setMessage} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FlashPanel
          connected={connected}
          busy={busy}
          progress={progress}
          onCustomFlash={(f, addr) => void onCustomFlash(f, addr)}
          onBackup={(size) => void onBackup(size)}
          onBeforeWebTools={onBeforeWebTools}
        />
        <BoardWebPanel />
      </div>

      <footer className="mt-8 text-center text-xs text-ink-700/60">
        纯前端 · Web Serial + esptool-js + esp-web-tools · 默认波特率 {DEFAULT_BAUD}
      </footer>
    </div>
  );
}
