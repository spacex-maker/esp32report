import { useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, RefreshCw, X } from "lucide-react";
import type { ChipInfo } from "../esp/espTool";
import { formatBytes, type DeviceInfoReport } from "../device/collectInfo";

type Props = {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  report: DeviceInfoReport | null;
  chipInfo?: ChipInfo | null;
  onRefresh?: () => void;
};

const SECTION_TITLE: Record<string, string> = {
  system: "系统 / MicroPython",
  memory: "内存",
  machine: "MCU / 时钟 / 复位",
  flashFs: "Flash / 文件系统",
  network: "网络 (STA / AP)",
  sensors: "片上传感器",
  files: "根目录文件",
  chip: "esptool 芯片探测",
  partitions: "分区表",
  modules: "可选模块",
  errors: "采集告警",
};

const LABEL_ZH: Record<string, string> = {
  python: "Python 版本",
  implementation: "实现",
  platform: "平台",
  byteorder: "字节序",
  maxsize: "maxsize",
  path: "sys.path",
  sysname: "sysname",
  nodename: "nodename",
  release: "release",
  version: "version 串",
  machine: "machine 串",
  sys_modules_count: "已加载模块数",
  sys_modules_sample: "已加载模块样例",
  mem_free: "空闲堆",
  mem_alloc: "已用堆",
  mem_total: "堆合计",
  stack_use: "栈使用",
  freq_hz: "CPU 频率",
  unique_id_hex: "芯片唯一 ID",
  reset_cause: "复位原因码",
  reset_cause_name: "复位原因",
  wake_reason: "唤醒原因",
  rtc_datetime: "RTC 时间",
  ticks_ms: "ticks_ms",
  ticks_us: "ticks_us",
  time_epoch: "time()",
  esp_flash_size: "esp.flash_size",
  esp_flash_user_start: "用户 Flash 起点",
  statvfs_bsize: "块大小",
  statvfs_frsize: "片段大小",
  statvfs_blocks: "总块数",
  statvfs_bfree: "空闲块",
  statvfs_bavail: "可用块",
  fs_total_bytes: "FS 总容量",
  fs_free_bytes: "FS 剩余",
  fs_used_bytes: "FS 已用",
  sta_active: "STA 已激活",
  sta_connected: "STA 已连接",
  sta_status: "STA 状态码",
  sta_ifconfig: "STA ifconfig",
  sta_mac: "STA MAC (hex)",
  sta_mac_colon: "STA MAC",
  sta_ssid: "已连 SSID",
  sta_channel: "信道",
  scan_count: "扫描到 AP 数",
  scan_top: "信号最强若干",
  ap_active: "AP 已激活",
  ap_ifconfig: "AP ifconfig",
  ap_mac_colon: "AP MAC",
  ap_essid: "AP ESSID",
  ap_channel: "AP 信道",
  ap_authmode: "AP 认证",
  raw_temperature: "内部温度(raw)",
  hall_sensor: "霍尔传感器",
  root_listdir: "根目录列表",
  chipName: "芯片系列",
  chipDescription: "芯片型号",
  revision: "Revision",
  features: "特性",
  crystalMhz: "晶振",
  macSta: "MAC STA",
  macAp: "MAC AP",
  flashManufacturer: "Flash 厂商",
  flashDeviceId: "Flash 器件 ID",
  flashSize: "Flash 容量",
  flashMode: "Flash 模式",
  flashFreq: "Flash 速度",
  flashEncryption: "Flash 加密",
  secureBootV1: "Secure Boot V1",
  secureBootV2: "Secure Boot V2",
  jtag: "JTAG",
};

function prettyValue(key: string, value: string): string {
  if (
    key.includes("bytes") ||
    key === "mem_free" ||
    key === "mem_alloc" ||
    key === "mem_total" ||
    key === "esp_flash_size" ||
    key === "stack_use"
  ) {
    const n = Number(value);
    if (!Number.isNaN(n) && value !== "") return `${formatBytes(n)}（${value}）`;
  }
  if (key === "freq_hz") {
    const n = Number(value);
    if (!Number.isNaN(n)) return `${(n / 1e6).toFixed(0)} MHz（${value} Hz）`;
  }
  return value || "—";
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-display text-sm font-semibold tracking-wide text-board-700">
        {title}
      </h3>
      <dl className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        {rows.map((r) => (
          <div
            key={r.label + r.value}
            className="grid grid-cols-1 gap-0.5 border-b border-ink-100 px-3 py-2 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-3"
          >
            <dt className="text-xs text-ink-700/70 sm:text-sm">{r.label}</dt>
            <dd className="break-all font-mono text-[12px] text-ink-900 sm:text-[13px]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function recordToRows(rec: Record<string, string>): Array<{ label: string; value: string }> {
  return Object.entries(rec)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => ({
      label: LABEL_ZH[k] ?? k,
      value: prettyValue(k, v),
    }));
}

export function DeviceInfoModal({
  open,
  onClose,
  loading,
  report,
  chipInfo,
  onRefresh,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const chipRows = useMemo(() => {
    if (!chipInfo) return [];
    return [
      { label: LABEL_ZH.chipDescription!, value: chipInfo.chipDescription || chipInfo.chipName },
      { label: LABEL_ZH.chipName!, value: chipInfo.chipName },
      { label: LABEL_ZH.revision!, value: chipInfo.revision == null ? "—" : String(chipInfo.revision) },
      { label: LABEL_ZH.features!, value: chipInfo.features.join(", ") || "—" },
      {
        label: LABEL_ZH.crystalMhz!,
        value: chipInfo.crystalMhz == null ? "—" : `${chipInfo.crystalMhz} MHz`,
      },
      { label: LABEL_ZH.macSta!, value: chipInfo.macSta },
      { label: LABEL_ZH.macAp!, value: `${chipInfo.macAp}（STA+1）` },
      { label: LABEL_ZH.flashManufacturer!, value: chipInfo.flashManufacturer },
      { label: LABEL_ZH.flashDeviceId!, value: `0x${chipInfo.flashDeviceId}` },
      {
        label: LABEL_ZH.flashSize!,
        value: `${chipInfo.flashSize}（${formatBytes(chipInfo.flashSizeBytes)}）`,
      },
      { label: LABEL_ZH.flashMode!, value: chipInfo.flashMode },
      { label: LABEL_ZH.flashFreq!, value: chipInfo.flashFreq },
      { label: LABEL_ZH.flashEncryption!, value: chipInfo.flashEncryption },
      { label: LABEL_ZH.secureBootV1!, value: chipInfo.secureBootV1 },
      { label: LABEL_ZH.secureBootV2!, value: chipInfo.secureBootV2 },
      { label: LABEL_ZH.jtag!, value: chipInfo.jtag },
    ];
  }, [chipInfo]);

  const exportPayload = useMemo(() => {
    return JSON.stringify(
      {
        collectedAt: report?.collectedAt ?? null,
        microPython: report,
        esptoolChip: chipInfo ?? null,
      },
      null,
      2,
    );
  }, [report, chipInfo]);

  if (!open) return null;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(exportPayload);
    } catch {
      /* ignore */
    }
  };

  const downloadJson = () => {
    const blob = new Blob([exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `esp32-device-info-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-ink-900/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-ink-200 bg-[#f7f9fa] shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-lg font-semibold text-ink-900">
              设备信息
            </h2>
            <p className="truncate text-xs text-ink-700/65">
              {report?.collectedAt ? `采集于 ${report.collectedAt}` : loading ? "正在从板子读取…" : "—"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {onRefresh ? (
              <button
                type="button"
                className="btn-secondary !px-2.5 !py-1.5 text-xs"
                disabled={loading}
                onClick={onRefresh}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                刷新
              </button>
            ) : null}
            <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => void copyAll()}>
              <Copy className="h-3.5 w-3.5" />
              复制
            </button>
            <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={downloadJson}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
            <button type="button" className="btn-secondary !px-2 !py-1.5" aria-label="关闭" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !report ? (
            <p className="py-16 text-center text-sm text-ink-700/70">正在采集详细信息，请稍候…</p>
          ) : null}

          {chipRows.length > 0 ? <Section title={SECTION_TITLE.chip!} rows={chipRows} /> : null}

          {report ? (
            <>
              <Section title={SECTION_TITLE.system!} rows={recordToRows(report.system)} />
              <Section title={SECTION_TITLE.machine!} rows={recordToRows(report.machine)} />
              <Section title={SECTION_TITLE.memory!} rows={recordToRows(report.memory)} />
              <Section title={SECTION_TITLE.flashFs!} rows={recordToRows(report.flashFs)} />
              <Section title={SECTION_TITLE.network!} rows={recordToRows(report.network)} />
              <Section title={SECTION_TITLE.sensors!} rows={recordToRows(report.sensors)} />
              <Section title={SECTION_TITLE.files!} rows={recordToRows(report.files)} />

              {report.partitions.length > 0 ? (
                <Section
                  title={SECTION_TITLE.partitions!}
                  rows={report.partitions.map((p, i) => ({
                    label: p.label || p.type || `分区 ${i + 1}`,
                    value: p.info || JSON.stringify(p),
                  }))}
                />
              ) : null}

              {report.modules.length > 0 ? (
                <Section
                  title={SECTION_TITLE.modules!}
                  rows={[{ label: "可导入模块", value: report.modules.join(", ") }]}
                />
              ) : null}

              {report.errors.length > 0 ? (
                <Section
                  title={SECTION_TITLE.errors!}
                  rows={report.errors.map((e, i) => ({ label: `#${i + 1}`, value: e }))}
                />
              ) : null}
            </>
          ) : null}

          {!loading && !report && chipRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-700/70">暂无数据</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
