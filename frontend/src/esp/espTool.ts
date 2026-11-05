import {
  ESPLoader,
  Transport,
  type FlashFreqValues,
  type FlashModeValues,
  type FlashOptions,
  type FlashSizeValues,
  type IEspLoaderTerminal,
  type LoaderOptions,
} from "esptool-js";

export type ChipInfo = {
  chipName: string;
  chipDescription: string;
  revision: number | null;
  features: string[];
  macSta: string;
  macAp: string;
  crystalMhz: number | null;
  flashManufacturer: string;
  flashDeviceId: string;
  flashSize: string;
  flashSizeBytes: number;
  flashMode: string;
  flashFreq: string;
  flashEncryption: string;
  secureBootV1: string;
  secureBootV2: string;
  jtag: string;
  rawLog: string[];
};

export type ProgressFn = (written: number, total: number, label?: string) => void;

const FLASH_VENDORS: Record<number, string> = {
  0xef: "Winbond",
  0xc8: "GigaDevice",
  0x20: "XMC / Micron",
  0xa1: "Fudan",
  0x85: "Puya",
  0x68: "Boya",
  0x5e: "Zbit",
  0x0b: "XTX",
  0x1c: "Eon",
};

const FLASH_MODES = ["QIO", "QOUT", "DIO", "DOUT"] as const;

function parseFlashFreqNibble(n: number): string {
  const map: Record<number, string> = {
    0x0: "40MHz",
    0x1: "26MHz",
    0x2: "20MHz",
    0xf: "80MHz",
  };
  return map[n] ?? `0x${n.toString(16)}`;
}

function bumpMac(mac: string): string {
  const parts = mac.split(":").map((x) => parseInt(x, 16));
  if (parts.length !== 6 || parts.some((n) => Number.isNaN(n))) return mac;
  parts[5] = ((parts[5] ?? 0) + 1) & 0xff;
  return parts.map((n) => n.toString(16).padStart(2, "0")).join(":");
}

function popcount(n: number): number {
  let c = 0;
  let v = n >>> 0;
  while (v) {
    c += v & 1;
    v >>>= 1;
  }
  return c;
}

type EfuseReadable = {
  readEfuse?: (loader: ESPLoader, offset: number) => Promise<number>;
};

async function readEsp32Security(loader: ESPLoader): Promise<{
  flashEncryption: string;
  secureBootV1: string;
  secureBootV2: string;
  jtag: string;
}> {
  const chip = loader.chip as unknown as EfuseReadable;
  if (typeof chip.readEfuse !== "function") {
    return {
      flashEncryption: "未知（当前芯片未暴露 eFuse 读取）",
      secureBootV1: "未知",
      secureBootV2: "未知",
      jtag: "未知",
    };
  }

  // ESP32 classic BLK0 layout（espefuse）
  const word0 = await chip.readEfuse(loader, 0);
  const word6 = await chip.readEfuse(loader, 6);

  const flashCryptCnt = (word0 >>> 20) & 0x7f;
  const encOn = popcount(flashCryptCnt) % 2 === 1;

  const absDone0 = (word6 >>> 4) & 0x1;
  const absDone1 = (word6 >>> 5) & 0x1;
  const disableJtag = (word6 >>> 15) & 0x1;

  return {
    flashEncryption: encOn ? `已开启（FLASH_CRYPT_CNT=${flashCryptCnt}）` : "未开启",
    secureBootV1: absDone0 ? "已开启（ABS_DONE_0）" : "未开启",
    secureBootV2: absDone1 ? "已开启（ABS_DONE_1）" : "未开启",
    jtag: disableJtag ? "已禁用" : "可用",
  };
}

async function readFlashHeaderMeta(
  loader: ESPLoader,
): Promise<{ mode: string; freq: string }> {
  // ESP32 常见镜像在 0x1000；合并固件可能在 0x0
  for (const addr of [0x1000, 0x0]) {
    try {
      const hdr = await loader.readFlash(addr, 16);
      if (hdr[0] !== 0xe9) continue;
      const mode = FLASH_MODES[hdr[2] ?? 3] ?? `0x${(hdr[2] ?? 0).toString(16)}`;
      const freq = parseFlashFreqNibble((hdr[3] ?? 0) & 0x0f);
      return { mode, freq };
    } catch {
      /* try next */
    }
  }
  return { mode: "未知", freq: "未知" };
}

function createLogTerminal(lines: string[]): IEspLoaderTerminal {
  return {
    clean() {
      lines.length = 0;
    },
    writeLine(data: string) {
      lines.push(data);
    },
    write(data: string) {
      if (data.endsWith("\n")) {
        lines.push(data.replace(/\n$/, ""));
      } else {
        const last = lines[lines.length - 1];
        if (last != null && !last.endsWith("\n")) {
          lines[lines.length - 1] = last + data;
        } else {
          lines.push(data);
        }
      }
    },
  };
}

export async function withEspLoader<T>(
  port: SerialPort,
  baudrate: number,
  fn: (loader: ESPLoader, transport: Transport, log: string[]) => Promise<T>,
): Promise<T> {
  const log: string[] = [];
  const transport = new Transport(port, true);
  const options: LoaderOptions = {
    transport,
    baudrate,
    terminal: createLogTerminal(log),
    debugLogging: false,
  };
  const loader = new ESPLoader(options);

  try {
    await loader.main();
    return await fn(loader, transport, log);
  } finally {
    try {
      await transport.disconnect();
    } catch {
      /* ignore */
    }
  }
}

export async function probeChipInfo(port: SerialPort, baudrate: number): Promise<ChipInfo> {
  return withEspLoader(port, baudrate, async (loader, _t, log) => {
    const chipName = loader.chip.CHIP_NAME;
    const chipDescription = await loader.chip.getChipDescription(loader);
    const features = await loader.chip.getChipFeatures(loader);
    const macSta = await loader.chip.readMac(loader);
    const macAp = bumpMac(macSta);

    let revision: number | null = null;
    if (loader.chip.getChipRevision) {
      revision = await loader.chip.getChipRevision(loader);
    }

    let crystalMhz: number | null = null;
    try {
      crystalMhz = await loader.chip.getCrystalFreq(loader);
    } catch {
      crystalMhz = null;
    }

    const flashId = await loader.readFlashId();
    const mfgId = flashId & 0xff;
    const flashManufacturer = FLASH_VENDORS[mfgId] ?? `未知(0x${mfgId.toString(16)})`;
    const flashDeviceId = ((flashId >> 8) & 0xffff).toString(16).padStart(4, "0");
    const flashSize = await loader.detectFlashSize();
    const flashSizeBytes = loader.flashSizeBytes(flashSize as FlashSizeValues);

    const header = await readFlashHeaderMeta(loader);
    const security = await readEsp32Security(loader);

    // 复位回用户代码（MicroPython）
    try {
      await loader.after("hard_reset");
    } catch {
      /* ignore */
    }

    return {
      chipName,
      chipDescription,
      revision,
      features,
      macSta,
      macAp,
      crystalMhz,
      flashManufacturer,
      flashDeviceId,
      flashSize,
      flashSizeBytes,
      flashMode: header.mode,
      flashFreq: header.freq,
      flashEncryption: security.flashEncryption,
      secureBootV1: security.secureBootV1,
      secureBootV2: security.secureBootV2,
      jtag: security.jtag,
      rawLog: [...log],
    };
  });
}

const CHUNK = 0x10000; // 64KB

export async function backupFlash(
  port: SerialPort,
  baudrate: number,
  totalSize: number,
  onProgress?: ProgressFn,
): Promise<Blob> {
  return withEspLoader(port, baudrate, async (loader) => {
    const parts: BlobPart[] = [];
    let offset = 0;
    while (offset < totalSize) {
      const len = Math.min(CHUNK, totalSize - offset);
      const chunk = await loader.readFlash(offset, len, (_pkt, progress, total) => {
        onProgress?.(offset + progress, totalSize, `读取 0x${offset.toString(16)}`);
        void total;
      });
      // 拷贝，避免底层复用缓冲
      parts.push(chunk.slice());
      offset += len;
      onProgress?.(offset, totalSize, `已完成 0x${offset.toString(16)}`);
    }

    try {
      await loader.after("hard_reset");
    } catch {
      /* ignore */
    }

    return new Blob(parts, { type: "application/octet-stream" });
  });
}

export type FlashBinOptions = {
  data: Uint8Array;
  address: number;
  flashMode?: FlashModeValues;
  flashFreq?: FlashFreqValues;
  flashSize?: FlashSizeValues;
  eraseAll?: boolean;
  onProgress?: ProgressFn;
};

/** 简易 MD5（用于 esptool-js verify） */
export function md5Hex(bytes: Uint8Array): string {
  // 使用 Spark-style 纯实现会偏长；这里用分块 + 内联 RFC1321 精简版
  return md5(bytes);
}

/* MD5 — compact implementation */
function md5(data: Uint8Array): string {
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = (a + q + x + t) | 0;
    return (((a << s) | (a >>> (32 - s))) + b) | 0;
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const n = data.length;
  const words: number[] = [];
  for (let i = 0; i < n; i++) {
    words[i >> 2] = (words[i >> 2] ?? 0) | (data[i]! << ((i % 4) * 8));
  }
  words[n >> 2] = (words[n >> 2] ?? 0) | (0x80 << ((n % 4) * 8));
  const lenBits = n * 8;
  const size = (((n + 8) >> 6) + 1) * 16;
  words.length = size;
  words[size - 2] = lenBits & 0xffffffff;
  words[size - 1] = Math.floor(lenBits / 0x100000000);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let i = 0; i < size; i += 16) {
    const oa = a,
      ob = b,
      oc = c,
      od = d;
    const w = (j: number) => words[i + j] ?? 0;

    a = ff(a, b, c, d, w(0), 7, 0xd76aa478);
    d = ff(d, a, b, c, w(1), 12, 0xe8c7b756);
    c = ff(c, d, a, b, w(2), 17, 0x242070db);
    b = ff(b, c, d, a, w(3), 22, 0xc1bdceee);
    a = ff(a, b, c, d, w(4), 7, 0xf57c0faf);
    d = ff(d, a, b, c, w(5), 12, 0x4787c62a);
    c = ff(c, d, a, b, w(6), 17, 0xa8304613);
    b = ff(b, c, d, a, w(7), 22, 0xfd469501);
    a = ff(a, b, c, d, w(8), 7, 0x698098d8);
    d = ff(d, a, b, c, w(9), 12, 0x8b44f7af);
    c = ff(c, d, a, b, w(10), 17, 0xffff5bb1);
    b = ff(b, c, d, a, w(11), 22, 0x895cd7be);
    a = ff(a, b, c, d, w(12), 7, 0x6b901122);
    d = ff(d, a, b, c, w(13), 12, 0xfd987193);
    c = ff(c, d, a, b, w(14), 17, 0xa679438e);
    b = ff(b, c, d, a, w(15), 22, 0x49b40821);

    a = gg(a, b, c, d, w(1), 5, 0xf61e2562);
    d = gg(d, a, b, c, w(6), 9, 0xc040b340);
    c = gg(c, d, a, b, w(11), 14, 0x265e5a51);
    b = gg(b, c, d, a, w(0), 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, w(5), 5, 0xd62f105d);
    d = gg(d, a, b, c, w(10), 9, 0x02441453);
    c = gg(c, d, a, b, w(15), 14, 0xd8a1e681);
    b = gg(b, c, d, a, w(4), 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, w(9), 5, 0x21e1cde6);
    d = gg(d, a, b, c, w(14), 9, 0xc33707d6);
    c = gg(c, d, a, b, w(3), 14, 0xf4d50d87);
    b = gg(b, c, d, a, w(8), 20, 0x455a14ed);
    a = gg(a, b, c, d, w(13), 5, 0xa9e3e905);
    d = gg(d, a, b, c, w(2), 9, 0xfcefa3f8);
    c = gg(c, d, a, b, w(7), 14, 0x676f02d9);
    b = gg(b, c, d, a, w(12), 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, w(5), 4, 0xfffa3942);
    d = hh(d, a, b, c, w(8), 11, 0x8771f681);
    c = hh(c, d, a, b, w(11), 16, 0x6d9d6122);
    b = hh(b, c, d, a, w(14), 23, 0xfde5380c);
    a = hh(a, b, c, d, w(1), 4, 0xa4beea44);
    d = hh(d, a, b, c, w(4), 11, 0x4bdecfa9);
    c = hh(c, d, a, b, w(7), 16, 0xf6bb4b60);
    b = hh(b, c, d, a, w(10), 23, 0xbebfbc70);
    a = hh(a, b, c, d, w(13), 4, 0x289b7ec6);
    d = hh(d, a, b, c, w(0), 11, 0xeaa127fa);
    c = hh(c, d, a, b, w(3), 16, 0xd4ef3085);
    b = hh(b, c, d, a, w(6), 23, 0x04881d05);
    a = hh(a, b, c, d, w(9), 4, 0xd9d4d039);
    d = hh(d, a, b, c, w(12), 11, 0xe6db99e5);
    c = hh(c, d, a, b, w(15), 16, 0x1fa27cf8);
    b = hh(b, c, d, a, w(2), 23, 0xc4ac5665);

    a = ii(a, b, c, d, w(0), 6, 0xf4292244);
    d = ii(d, a, b, c, w(7), 10, 0x432aff97);
    c = ii(c, d, a, b, w(14), 15, 0xab9423a7);
    b = ii(b, c, d, a, w(5), 21, 0xfc93a039);
    a = ii(a, b, c, d, w(12), 6, 0x655b59c3);
    d = ii(d, a, b, c, w(3), 10, 0x8f0ccc92);
    c = ii(c, d, a, b, w(10), 15, 0xffeff47d);
    b = ii(b, c, d, a, w(1), 21, 0x85845dd1);
    a = ii(a, b, c, d, w(8), 6, 0x6fa87e4f);
    d = ii(d, a, b, c, w(15), 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, w(6), 15, 0xa3014314);
    b = ii(b, c, d, a, w(13), 21, 0x4e0811a1);
    a = ii(a, b, c, d, w(4), 6, 0xf7537e82);
    d = ii(d, a, b, c, w(11), 10, 0xbd3af235);
    c = ii(c, d, a, b, w(2), 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, w(9), 21, 0xeb86d391);

    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }

  function hex(n: number) {
    let s = "";
    for (let j = 0; j < 4; j++) {
      s += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return s;
  }
  return hex(a) + hex(b) + hex(c) + hex(d);
}

export async function flashFirmware(
  port: SerialPort,
  baudrate: number,
  opts: FlashBinOptions,
): Promise<void> {
  await withEspLoader(port, baudrate, async (loader) => {
    const flashOptions: FlashOptions = {
      fileArray: [{ data: opts.data, address: opts.address }],
      flashMode: opts.flashMode ?? "dio",
      flashFreq: opts.flashFreq ?? "40m",
      flashSize: opts.flashSize ?? "detect",
      eraseAll: opts.eraseAll ?? false,
      compress: true,
      reportProgress: (_fileIndex, written, total) => {
        opts.onProgress?.(written, total, "烧录");
      },
      calculateMD5Hash: (image) => md5Hex(image),
    };
    await loader.writeFlash(flashOptions);
    await loader.after("hard_reset");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function createDynamicManifestUrl(binUrl: string, offset = 0x1000): string {
  const manifest = {
    name: "自定义固件",
    version: "local",
    new_install_prompt_erase: true,
    builds: [
      {
        chipFamily: "ESP32",
        parts: [{ path: binUrl, offset }],
      },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  return URL.createObjectURL(blob);
}
