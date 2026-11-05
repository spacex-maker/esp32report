import { useState } from "react";
import { Activity, Zap } from "lucide-react";
import type { MicroPythonRepl } from "../repl/microPythonRepl";
import type { ChipInfo } from "../esp/espTool";
import { collectDetailedDeviceInfo, type DeviceInfoReport } from "../device/collectInfo";
import { DeviceInfoModal } from "./DeviceInfoModal";

type Props = {
  connected: boolean;
  busy: boolean;
  repl: MicroPythonRepl | null;
  chipInfo?: ChipInfo | null;
  onMessage: (msg: string) => void;
};

export function QuickTools({ connected, busy, repl, chipInfo = null, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeviceInfoReport | null>(null);

  async function fetchInfo() {
    if (!repl) return;
    setOpen(true);
    setLoading(true);
    try {
      const data = await collectDetailedDeviceInfo(repl);
      setReport(data);
      onMessage("已采集详细设备信息。");
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="panel p-5 animate-fade-up" style={{ animationDelay: "50ms" }}>
        <h2 className="font-display text-lg font-semibold text-ink-900">快捷工具</h2>
        <p className="mt-1 text-sm text-ink-700/75">
          通过 REPL 采集详细设备信息（不进入下载模式），结果在独立窗口查看。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!connected || busy || !repl || loading}
            onClick={() => void fetchInfo()}
          >
            <Activity className="h-4 w-4" />
            {loading ? "采集中…" : "设备信息"}
          </button>
          {report || chipInfo ? (
            <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
              查看上次结果
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            disabled={!connected || busy || !repl}
            onClick={() => void repl?.interrupt()}
          >
            <Zap className="h-4 w-4" />
            中断运行
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!connected || busy || !repl}
            onClick={() => void repl?.softReset()}
          >
            软重启 REPL
          </button>
        </div>
      </section>

      <DeviceInfoModal
        open={open}
        onClose={() => setOpen(false)}
        loading={loading}
        report={report}
        chipInfo={chipInfo}
        onRefresh={connected && repl && !busy ? () => void fetchInfo() : undefined}
      />
    </>
  );
}
