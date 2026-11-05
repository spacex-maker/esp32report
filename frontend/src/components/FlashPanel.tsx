import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { createDynamicManifestUrl } from "../esp/espTool";
import { EspWebInstallButton } from "./EspWebInstallButton";
import { SelectMenu } from "./SelectMenu";

type Props = {
  connected: boolean;
  busy: boolean;
  progress: { label: string; pct: number } | null;
  onCustomFlash: (file: File, address: number) => void;
  onBackup: (sizeBytes: number) => void;
  onBeforeWebTools: () => Promise<void>;
};

const OFFSET_OPTIONS = [
  { value: "0x0", label: "0x0", hint: "合并固件 / 整片镜像" },
  { value: "0x1000", label: "0x1000", hint: "ESP32 MicroPython 常见" },
  { value: "0x8000", label: "0x8000", hint: "分区表附近" },
  { value: "0x10000", label: "0x10000", hint: "应用区常见起点" },
] as const;

const BACKUP_OPTIONS = [
  { value: 2, label: "2 MB", hint: "较小 Flash" },
  { value: 4, label: "4 MB", hint: "本板常见容量" },
  { value: 8, label: "8 MB", hint: "大容量模组" },
  { value: 16, label: "16 MB", hint: "超大 Flash" },
] as const;

export function FlashPanel({
  connected,
  busy,
  progress,
  onCustomFlash,
  onBackup,
  onBeforeWebTools,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [address, setAddress] = useState<string>("0x1000");
  const [backupMb, setBackupMb] = useState(4);
  const [manifestUrl, setManifestUrl] = useState("/manifest.json");
  const [dragOver, setDragOver] = useState(false);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const u of objectUrls.current) URL.revokeObjectURL(u);
    };
  }, []);

  const addressNum = useMemo(() => {
    const n = Number.parseInt(address, 16);
    return Number.isFinite(n) ? n : 0x1000;
  }, [address]);

  function revokePrev() {
    for (const u of objectUrls.current) URL.revokeObjectURL(u);
    objectUrls.current = [];
  }

  function acceptBin(f: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".bin")) {
      alert("请选择 .bin 固件文件");
      return;
    }
    setFile(f);
    revokePrev();
    const binUrl = URL.createObjectURL(f);
    const mUrl = createDynamicManifestUrl(binUrl, addressNum);
    objectUrls.current = [binUrl, mUrl];
    setManifestUrl(mUrl);
  }

  useEffect(() => {
    if (!file) return;
    revokePrev();
    const binUrl = URL.createObjectURL(file);
    const mUrl = createDynamicManifestUrl(binUrl, addressNum);
    objectUrls.current = [binUrl, mUrl];
    setManifestUrl(mUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressNum]);

  return (
    <section className="panel p-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <h2 className="font-display text-lg font-semibold text-ink-900">固件烧录 / 整片备份</h2>
      <p className="mt-1 text-sm text-ink-700/75">
        主路径使用 esp-web-tools 安装按钮；也可拖入自定义 .bin 用 esptool-js 烧录。备份按 64KB 分段读取，避免一次性占用 4MB 大数组。
      </p>

      <div
        className={`mt-4 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver ? "border-board-500 bg-board-50" : "border-ink-200 bg-ink-50/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptBin(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-board-600" />
        <p className="text-sm text-ink-800">拖放 .bin 到此处，或</p>
        <label className="btn-secondary mt-3 cursor-pointer">
          选择文件
          <input
            type="file"
            accept=".bin,application/octet-stream"
            className="hidden"
            onChange={(e) => acceptBin(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? (
          <p className="mt-3 font-mono text-xs text-ink-700">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="flash-offset">
            烧录偏移
          </label>
          <SelectMenu
            id="flash-offset"
            value={address}
            options={[...OFFSET_OPTIONS]}
            onChange={setAddress}
            disabled={busy}
          />
        </div>
        <div>
          <label className="label" htmlFor="backup-size">
            备份大小
          </label>
          <SelectMenu
            id="backup-size"
            value={backupMb}
            options={[...BACKUP_OPTIONS]}
            onChange={setBackupMb}
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={!connected || !file || busy}
          onClick={() => file && onCustomFlash(file, addressNum)}
        >
          <Upload className="h-4 w-4" />
          自定义 bin 烧录
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!connected || busy}
          onClick={() => onBackup(backupMb * 1024 * 1024)}
        >
          <Download className="h-4 w-4" />
          整片备份
        </button>

        <div className="ml-auto flex items-center gap-2">
          <EspWebInstallButton
            manifest={manifestUrl}
            disabled={busy}
            onBeforeActivate={onBeforeWebTools}
          />
        </div>
      </div>

      {progress ? (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-ink-700/80">
            <span>{progress.label}</span>
            <span>{progress.pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink-100">
            <div
              className="relative h-full rounded-full bg-board-500 transition-[width] duration-200"
              style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
            >
              <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
