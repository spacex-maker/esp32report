import type { MicroPythonRepl } from "../repl/microPythonRepl";

/** 结构化设备信息（由板端 MicroPython 采集） */
export type DeviceInfoReport = {
  collectedAt: string;
  system: Record<string, string>;
  memory: Record<string, string>;
  machine: Record<string, string>;
  flashFs: Record<string, string>;
  network: Record<string, string>;
  sensors: Record<string, string>;
  files: Record<string, string>;
  modules: string[];
  partitions: Array<Record<string, string>>;
  rawJson?: unknown;
  errors: string[];
};

const COLLECT_CODE = `
import json, sys, os, gc, time, machine, network, micropython

out = {
  "system": {},
  "memory": {},
  "machine": {},
  "flashFs": {},
  "network": {},
  "sensors": {},
  "files": {},
  "modules": [],
  "partitions": [],
  "errors": [],
}

def put(section, key, value):
    try:
        out[section][key] = "" if value is None else str(value)
    except Exception as e:
        out["errors"].append("%s.%s: %s" % (section, key, e))

try:
    put("system", "python", sys.version)
    put("system", "implementation", str(getattr(sys, "implementation", "")))
    put("system", "platform", getattr(sys, "platform", ""))
    put("system", "byteorder", getattr(sys, "byteorder", ""))
    put("system", "maxsize", getattr(sys, "maxsize", ""))
    put("system", "path", ":".join(sys.path) if getattr(sys, "path", None) else "")
    u = os.uname()
    put("system", "sysname", u.sysname)
    put("system", "nodename", u.nodename)
    put("system", "release", u.release)
    put("system", "version", u.version)
    put("system", "machine", u.machine)
except Exception as e:
    out["errors"].append("system: " + str(e))

try:
    gc.collect()
    put("memory", "mem_free", gc.mem_free())
    put("memory", "mem_alloc", gc.mem_alloc())
    put("memory", "mem_total", gc.mem_free() + gc.mem_alloc())
    try:
        put("memory", "stack_use", micropython.stack_use())
    except Exception:
        pass
    try:
        put("memory", "heap_lock_depth", "n/a")
    except Exception:
        pass
except Exception as e:
    out["errors"].append("memory: " + str(e))

try:
    put("machine", "freq_hz", machine.freq())
    put("machine", "unique_id_hex", machine.unique_id().hex())
    try:
        put("machine", "reset_cause", machine.reset_cause())
        causes = {
            0: "PWRON_RESET",
            1: "HARD_RESET",
            2: "WDT_RESET",
            3: "DEEPSLEEP_RESET",
            4: "SOFT_RESET",
        }
        # ESP32 MicroPython constants
        for name in ("PWRON_RESET", "HARD_RESET", "WDT_RESET", "DEEPSLEEP_RESET", "SOFT_RESET"):
            if hasattr(machine, name):
                causes[getattr(machine, name)] = name
        rc = machine.reset_cause()
        put("machine", "reset_cause_name", causes.get(rc, "UNKNOWN_%s" % rc))
    except Exception as e:
        out["errors"].append("reset_cause: " + str(e))
    try:
        put("machine", "wake_reason", machine.wake_reason())
    except Exception:
        pass
    try:
        rtc = machine.RTC()
        put("machine", "rtc_datetime", str(rtc.datetime()))
    except Exception as e:
        out["errors"].append("rtc: " + str(e))
    try:
        put("machine", "ticks_ms", time.ticks_ms())
        put("machine", "ticks_us", time.ticks_us())
        put("machine", "time_epoch", time.time())
    except Exception as e:
        out["errors"].append("time: " + str(e))
except Exception as e:
    out["errors"].append("machine: " + str(e))

try:
    import esp
    try:
        put("flashFs", "esp_flash_size", esp.flash_size())
    except Exception as e:
        out["errors"].append("esp.flash_size: " + str(e))
    try:
        put("flashFs", "esp_flash_user_start", esp.flash_user_start())
    except Exception:
        pass
    try:
        put("flashFs", "osdebug", "available")
    except Exception:
        pass
except Exception as e:
    out["errors"].append("esp: " + str(e))

try:
    st = os.statvfs("/")
    # f_bsize, f_frsize, f_blocks, f_bfree, f_bavail, ...
    put("flashFs", "statvfs_bsize", st[0])
    put("flashFs", "statvfs_frsize", st[1] if len(st) > 1 else "")
    put("flashFs", "statvfs_blocks", st[2])
    put("flashFs", "statvfs_bfree", st[3])
    put("flashFs", "statvfs_bavail", st[4] if len(st) > 4 else "")
    bsize = st[0] or 1
    put("flashFs", "fs_total_bytes", bsize * st[2])
    put("flashFs", "fs_free_bytes", bsize * st[3])
    put("flashFs", "fs_used_bytes", bsize * (st[2] - st[3]))
except Exception as e:
    out["errors"].append("statvfs: " + str(e))

try:
    names = os.listdir("/")
    put("files", "root_listdir", ", ".join(names))
    for name in names:
        path = "/" + name
        try:
            st = os.stat(path)
            mode = st[0]
            size = st[6] if len(st) > 6 else -1
            is_dir = (mode & 0x4000) != 0 or (mode & 0o170000) == 0o040000
            put("files", path, ("DIR" if is_dir else ("FILE %s bytes" % size)))
        except Exception as e:
            put("files", path, "ERR " + str(e))
except Exception as e:
    out["errors"].append("files: " + str(e))

try:
    import esp32
    try:
        put("sensors", "raw_temperature", esp32.raw_temperature())
    except Exception as e:
        out["errors"].append("temp: " + str(e))
    try:
        put("sensors", "hall_sensor", esp32.hall_sensor())
    except Exception as e:
        out["errors"].append("hall: " + str(e))
    try:
        put("sensors", "idf_heap_total", esp32.idf_heap_info(esp32.HEAP_DATA))
    except Exception:
        pass
    try:
        # NVS / ULPs not always present
        put("sensors", "gpio_pin_count", "via machine.Pin")
    except Exception:
        pass
except Exception as e:
    out["errors"].append("esp32: " + str(e))

try:
    sta = network.WLAN(network.STA_IF)
    put("network", "sta_active", sta.active())
    put("network", "sta_connected", sta.isconnected())
    try:
        put("network", "sta_status", sta.status())
    except Exception:
        pass
    try:
        put("network", "sta_ifconfig", str(sta.ifconfig()))
    except Exception:
        pass
    try:
        mac = sta.config("mac")
        put("network", "sta_mac", "".join("%02x" % b for b in mac))
        put("network", "sta_mac_colon", ":".join("%02x" % b for b in mac))
    except Exception as e:
        out["errors"].append("sta_mac: " + str(e))
    try:
        if sta.active():
            put("network", "sta_ssid", sta.config("essid"))
            put("network", "sta_channel", sta.config("channel"))
    except Exception:
        pass
    try:
        if sta.active():
            nets = sta.scan()
            put("network", "scan_count", len(nets))
            top = []
            for item in sorted(nets, key=lambda x: x[3], reverse=True)[:8]:
                ssid = item[0]
                if isinstance(ssid, (bytes, bytearray)):
                    ssid = ssid.decode()
                top.append("%s(%sdBm/ch%s)" % (ssid, item[3], item[2]))
            put("network", "scan_top", "; ".join(top))
    except Exception as e:
        out["errors"].append("wifi_scan: " + str(e))

    ap = network.WLAN(network.AP_IF)
    put("network", "ap_active", ap.active())
    try:
        put("network", "ap_ifconfig", str(ap.ifconfig()) if ap.active() else "inactive")
    except Exception:
        pass
    try:
        mac = ap.config("mac")
        put("network", "ap_mac_colon", ":".join("%02x" % b for b in mac))
    except Exception:
        pass
    try:
        if ap.active():
            put("network", "ap_essid", ap.config("essid"))
            put("network", "ap_channel", ap.config("channel"))
            put("network", "ap_authmode", ap.config("authmode"))
    except Exception:
        pass
except Exception as e:
    out["errors"].append("network: " + str(e))

try:
    import esp32
    # partition table
    try:
        for p in esp32.Partition.find(esp32.Partition.TYPE_APP):
            out["partitions"].append({
                "type": "APP",
                "label": str(p.info()[4]) if hasattr(p, "info") else str(p),
                "info": str(p.info()) if hasattr(p, "info") else str(p),
            })
        for p in esp32.Partition.find(esp32.Partition.TYPE_DATA):
            info = p.info() if hasattr(p, "info") else None
            out["partitions"].append({
                "type": "DATA",
                "label": str(info[4]) if info else str(p),
                "info": str(info) if info else str(p),
            })
    except Exception as e:
        out["errors"].append("partitions: " + str(e))
except Exception:
    pass

try:
    # 常见内置模块探测
    names = [
        "bluetooth", "bt", "aioespnow", "espnow", "ssl", "socket", "select",
        "hashlib", "binascii", "json", "re", "struct", "ctime", "ntptime",
        "framebuf", "neopixel", "onewire", "ds18x20", "dht", "ssd1306",
    ]
    present = []
    for name in names:
        try:
            __import__(name)
            present.append(name)
        except Exception:
            pass
    # 已加载模块
    try:
        loaded = list(sys.modules.keys()) if hasattr(sys, "modules") else []
        put("system", "sys_modules_count", len(loaded))
        put("system", "sys_modules_sample", ", ".join(sorted(loaded)[:40]))
    except Exception:
        pass
    out["modules"] = present
except Exception as e:
    out["errors"].append("modules: " + str(e))

print(json.dumps(out))
`;

function emptyReport(): DeviceInfoReport {
  return {
    collectedAt: new Date().toISOString(),
    system: {},
    memory: {},
    machine: {},
    flashFs: {},
    network: {},
    sensors: {},
    files: {},
    modules: [],
    partitions: [],
    errors: [],
  };
}

function asStringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = val == null ? "" : String(val);
  }
  return out;
}

export async function collectDetailedDeviceInfo(repl: MicroPythonRepl): Promise<DeviceInfoReport> {
  const { stdout, stderr } = await repl.runRaw(COLLECT_CODE.trim() + "\n", 45000);
  const report = emptyReport();
  if (stderr.trim()) {
    report.errors.push(stderr.trim());
  }

  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  const jsonLine = [...lines].reverse().find((l) => l.startsWith("{"));
  if (!jsonLine) {
    report.errors.push("未能解析板端 JSON 输出");
    report.system["raw_stdout"] = stdout.slice(0, 4000);
    return report;
  }

  try {
    const raw = JSON.parse(jsonLine) as Record<string, unknown>;
    report.rawJson = raw;
    report.system = asStringRecord(raw.system);
    report.memory = asStringRecord(raw.memory);
    report.machine = asStringRecord(raw.machine);
    report.flashFs = asStringRecord(raw.flashFs);
    report.network = asStringRecord(raw.network);
    report.sensors = asStringRecord(raw.sensors);
    report.files = asStringRecord(raw.files);
    report.modules = Array.isArray(raw.modules) ? raw.modules.map(String) : [];
    report.partitions = Array.isArray(raw.partitions)
      ? (raw.partitions as unknown[]).map((p) => asStringRecord(p))
      : [];
    if (Array.isArray(raw.errors)) {
      report.errors.push(...raw.errors.map(String));
    }
  } catch (e) {
    report.errors.push(`JSON 解析失败：${e instanceof Error ? e.message : String(e)}`);
    report.system["raw_stdout"] = stdout.slice(0, 4000);
  }

  return report;
}

export function formatBytes(n: string | number | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 / 1024).toFixed(2)} MB`;
}
