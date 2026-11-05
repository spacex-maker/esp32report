import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import type { ChipInfo } from "../esp/espTool";
import { DeviceInfoModal } from "./DeviceInfoModal";

type Props = {
  info: ChipInfo | null;
  busy: boolean;
  disabled: boolean;
  onProbe: () => void;
};

export function ChipInfoPanel({ info, busy, disabled, onProbe }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (info && !busy) setOpen(true);
  }, [info, busy]);

  return (
    <>
      <section className="panel p-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">芯片信息探测</h2>
            <p className="mt-1 text-sm text-ink-700/75">
              通过 esptool-js 进入下载模式读取型号、MAC、Flash 与 eFuse。结果在模态框中展示。
            </p>
          </div>
          <button type="button" className="btn-primary shrink-0" disabled={disabled || busy} onClick={onProbe}>
            <Radar className="h-4 w-4" />
            {busy ? "探测中…" : "探测"}
          </button>
        </div>

        {!info ? (
          <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-4 py-8 text-center text-sm text-ink-700/70">
            连接板子后点击「探测」
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-board-50 px-4 py-3 text-sm text-ink-800">
            <span className="font-mono text-[13px]">{info.chipDescription || info.chipName}</span>
            <span className="text-ink-700/60">·</span>
            <span className="font-mono text-[13px]">{info.macSta}</span>
            <button type="button" className="btn-secondary ml-auto !px-2.5 !py-1 text-xs" onClick={() => setOpen(true)}>
              查看详情
            </button>
          </div>
        )}
      </section>

      <DeviceInfoModal open={open} onClose={() => setOpen(false)} report={null} chipInfo={info} />
    </>
  );
}
