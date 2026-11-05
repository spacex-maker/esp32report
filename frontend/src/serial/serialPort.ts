import { mapSerialError } from "./errors";

export const DEFAULT_BAUD = 115200;

export type SerialDataHandler = (chunk: Uint8Array) => void;

/**
 * Web Serial 封装：连接 / 断开 / 读写循环 / 信号线。
 * REPL 与 esptool 互斥占用端口，切换前必须 stopReading + close。
 */
export class SerialPortSession {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readAbort = false;
  private reading = false;
  private onData: SerialDataHandler | null = null;
  private onDisconnect: (() => void) | null = null;
  private disconnectBound = false;

  get isOpen(): boolean {
    return this.port != null && this.port.readable != null;
  }

  get currentPort(): SerialPort | null {
    return this.port;
  }

  getInfo(): SerialPortInfo | null {
    return this.port?.getInfo() ?? null;
  }

  setDisconnectHandler(handler: (() => void) | null) {
    this.onDisconnect = handler;
  }

  private bindDisconnectEvents() {
    if (this.disconnectBound || !("serial" in navigator)) return;
    this.disconnectBound = true;
    navigator.serial.addEventListener("disconnect", (event) => {
      const lost = (event as Event & { target?: SerialPort }).target;
      if (this.port && lost === this.port) {
        void this.handleExternalDisconnect();
      }
    });
  }

  private async handleExternalDisconnect() {
    await this.releaseLocks();
    this.port = null;
    this.onDisconnect?.();
  }

  async requestAndOpen(baudRate: number = DEFAULT_BAUD): Promise<SerialPort> {
    if (!("serial" in navigator)) {
      throw new Error("Web Serial 不可用，请使用 Chrome / Edge。");
    }
    this.bindDisconnectEvents();

    try {
      const port = await navigator.serial.requestPort();
      await this.openExisting(port, baudRate);
      return port;
    } catch (err) {
      throw new Error(mapSerialError(err));
    }
  }

  async openExisting(port: SerialPort, baudRate: number = DEFAULT_BAUD) {
    await this.close();
    this.port = port;
    try {
      await port.open({ baudRate });
      // REPL 空闲时不要拉高 DTR/RTS，避免反复复位
      await this.setSignals({ dataTerminalReady: false, requestToSend: false });
    } catch (err) {
      this.port = null;
      throw new Error(mapSerialError(err));
    }
  }

  async setSignals(signals: SerialOutputSignals) {
    if (!this.port) return;
    try {
      await this.port.setSignals(signals);
    } catch {
      // 部分适配器不支持信号线，忽略
    }
  }

  async write(data: Uint8Array | string) {
    if (!this.port?.writable) {
      throw new Error("串口未打开，无法写入。");
    }
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  startReading(onData: SerialDataHandler) {
    if (!this.port?.readable) {
      throw new Error("串口未打开，无法读取。");
    }
    if (this.reading) {
      this.onData = onData;
      return;
    }
    this.onData = onData;
    this.readAbort = false;
    this.reading = true;
    void this.readLoop();
  }

  private async readLoop() {
    const port = this.port;
    if (!port?.readable) {
      this.reading = false;
      return;
    }

    try {
      this.reader = port.readable.getReader();
      while (!this.readAbort) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          this.onData?.(value);
        }
      }
    } catch (err) {
      if (!this.readAbort) {
        console.warn("serial read loop ended:", err);
      }
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {
        /* ignore */
      }
      this.reader = null;
      this.reading = false;
    }
  }

  async stopReading() {
    this.readAbort = true;
    this.onData = null;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        /* ignore */
      }
      try {
        this.reader.releaseLock();
      } catch {
        /* ignore */
      }
      this.reader = null;
    }
    // 给浏览器一点时间释放 readable lock
    await new Promise((r) => setTimeout(r, 30));
    this.reading = false;
  }

  private async releaseLocks() {
    await this.stopReading();
  }

  /**
   * 将端口交给 esptool：停止读写并关闭（Transport 会自行 open）。
   */
  async handoffForEsptool(): Promise<SerialPort> {
    if (!this.port) {
      throw new Error("尚未连接串口。");
    }
    const port = this.port;
    await this.releaseLocks();
    try {
      await port.close();
    } catch {
      /* 可能已关闭 */
    }
    // 保留 port 引用，便于 esptool 结束后 reopen
    return port;
  }

  async reopenAfterEsptool(baudRate: number = DEFAULT_BAUD) {
    if (!this.port) return;
    // 若仍打开则先关
    try {
      if (this.port.readable || this.port.writable) {
        await this.port.close();
      }
    } catch {
      /* ignore */
    }
    await this.port.open({ baudRate });
    await this.setSignals({ dataTerminalReady: false, requestToSend: false });
  }

  async close() {
    await this.releaseLocks();
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        /* ignore */
      }
    }
    this.port = null;
  }
}
