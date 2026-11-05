/** Web Serial 可用性与错误文案 */

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export function isSecureContextOk(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function mapSerialError(err: unknown): string {
  if (!(err instanceof Error)) {
    return `未知错误：${String(err)}`;
  }

  const name = err.name;
  const msg = err.message || "";

  if (name === "NotFoundError") {
    return "已取消选择串口，或未选中任何设备。";
  }
  if (name === "SecurityError") {
    return "当前页面不是安全上下文。请使用 http://localhost / http://127.0.0.1，或通过 HTTPS 访问。";
  }
  if (name === "NetworkError" || name === "InvalidStateError") {
    return "串口已断开或状态异常。请重新插拔设备后再次连接。";
  }
  if (name === "NotSupportedError") {
    return "当前浏览器不支持该串口操作。请使用 Chrome / Edge。";
  }
  if (/failed to open|already open|lock/i.test(msg)) {
    return `串口被占用或锁定：${msg}。请先断开其它占用（含本页 REPL），再重试。`;
  }

  return err.message || String(err);
}

export type PortInfo = {
  usbVendorId?: number;
  usbProductId?: number;
};

export function formatPortInfo(info: PortInfo): string {
  const vid = info.usbVendorId != null ? `0x${info.usbVendorId.toString(16).padStart(4, "0")}` : "?";
  const pid = info.usbProductId != null ? `0x${info.usbProductId.toString(16).padStart(4, "0")}` : "?";
  return `VID ${vid} / PID ${pid}`;
}
