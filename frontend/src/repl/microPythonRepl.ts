import type { SerialPortSession } from "../serial/serialPort";

const CTRL_A = 0x01;
const CTRL_B = 0x02;
const CTRL_C = 0x03;
const CTRL_D = 0x04;
const CTRL_E = 0x05;

export type ReplResult = {
  stdout: string;
  stderr: string;
};

/**
 * MicroPython raw / paste REPL 辅助。
 * 交互式终端走透传；代码块执行走 raw REPL。
 */
export class MicroPythonRepl {
  private buffer: Uint8Array = new Uint8Array(0);
  private waiters: Array<{
    predicate: (s: string) => boolean;
    resolve: (s: string) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private decoder = new TextDecoder("utf-8", { fatal: false });
  private passthrough: ((chunk: Uint8Array) => void) | null = null;
  private rawBusy = false;
  private session: SerialPortSession;

  constructor(session: SerialPortSession) {
    this.session = session;
  }

  attach() {
    this.session.startReading((chunk) => this.onChunk(chunk));
  }

  setPassthrough(handler: ((chunk: Uint8Array) => void) | null) {
    this.passthrough = handler;
  }

  private onChunk(chunk: Uint8Array) {
    if (!this.rawBusy && this.passthrough) {
      this.passthrough(chunk);
    }
    this.buffer = concat(this.buffer, chunk);
    this.flushWaiters();
  }

  private flushWaiters() {
    const text = this.decoder.decode(this.buffer, { stream: true });
    const view = bytesToLatin1(this.buffer);
    for (const w of [...this.waiters]) {
      if (w.predicate(view) || w.predicate(text)) {
        clearTimeout(w.timer);
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve(view);
      }
    }
  }

  private waitFor(predicate: (s: string) => boolean, timeoutMs: number, label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.timer !== timer);
        reject(new Error(`等待 ${label} 超时（${timeoutMs}ms）`));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timer });
      this.flushWaiters();
    });
  }

  private consumeUntilMarkers(first: number, second: number): { stdout: Uint8Array; stderr: Uint8Array } {
    const i1 = indexOfByte(this.buffer, first);
    if (i1 < 0) throw new Error("未找到 stdout 结束标记");
    const stdout = this.buffer.slice(0, i1);
    const rest = this.buffer.slice(i1 + 1);
    const i2 = indexOfByte(rest, second);
    if (i2 < 0) throw new Error("未找到 stderr 结束标记");
    const stderr = rest.slice(0, i2);
    this.buffer = rest.slice(i2 + 1);
    return { stdout, stderr };
  }

  private clearBuffer() {
    this.buffer = new Uint8Array(0);
  }

  async interrupt() {
    await this.session.write(new Uint8Array([CTRL_C]));
  }

  async softReset() {
    await this.session.write(new Uint8Array([CTRL_D]));
  }

  async writeUserInput(data: string | Uint8Array) {
    await this.session.write(data);
  }

  /** 进入 raw REPL 执行代码，再退回友好 REPL */
  async runRaw(code: string, timeoutMs = 15000): Promise<ReplResult> {
    this.rawBusy = true;
    this.clearBuffer();
    try {
      await this.session.write(new Uint8Array([CTRL_C, CTRL_C]));
      await sleep(50);
      this.clearBuffer();

      await this.session.write(new Uint8Array([CTRL_A]));
      await this.waitFor((s) => s.includes("raw REPL") || s.includes(">"), 5000, "进入 raw REPL");

      this.clearBuffer();
      const body = new TextEncoder().encode(code);
      await this.session.write(body);
      await this.session.write(new Uint8Array([CTRL_D]));

      await this.waitFor((s) => {
        const ok = s.indexOf("OK");
        if (ok < 0) return false;
        const after = s.slice(ok + 2);
        let count = 0;
        for (let i = 0; i < after.length; i++) {
          if (after.charCodeAt(i) === CTRL_D) count++;
        }
        return count >= 2;
      }, timeoutMs, "raw REPL 执行结果");

      const latin = bytesToLatin1(this.buffer);
      const okAt = latin.indexOf("OK");
      if (okAt >= 0) {
        this.buffer = this.buffer.slice(okAt + 2);
      }

      const { stdout, stderr } = this.consumeUntilMarkers(CTRL_D, CTRL_D);
      await this.session.write(new Uint8Array([CTRL_B]));
      await sleep(80);

      return {
        stdout: new TextDecoder("utf-8").decode(stdout),
        stderr: new TextDecoder("utf-8").decode(stderr),
      };
    } finally {
      this.rawBusy = false;
    }
  }

  /** paste 模式：适合多行，会回显，调用方自行展示 */
  async runPaste(code: string, timeoutMs = 20000): Promise<string> {
    this.rawBusy = true;
    this.clearBuffer();
    try {
      await this.session.write(new Uint8Array([CTRL_C, CTRL_C]));
      await sleep(50);
      this.clearBuffer();

      await this.session.write(new Uint8Array([CTRL_E]));
      await this.waitFor((s) => s.includes("paste mode") || s.includes("=== "), 5000, "进入 paste 模式");

      await this.session.write(new TextEncoder().encode(code));
      if (!code.endsWith("\n")) {
        await this.session.write("\n");
      }
      await this.session.write(new Uint8Array([CTRL_D]));

      await this.waitFor((s) => /\n>>> |\n> $/.test(s) || s.includes("\n>>>"), timeoutMs, "paste 执行完成");

      const raw = new TextDecoder("utf-8").decode(this.buffer);
      return stripPasteEcho(raw, code);
    } finally {
      this.rawBusy = false;
    }
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out: Uint8Array = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function indexOfByte(buf: Uint8Array, b: number): number {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === b) return i;
  }
  return -1;
}

function bytesToLatin1(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!);
  return s;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripPasteEcho(output: string, code: string): string {
  let text = output;
  text = text.replace(/paste mode[^\n]*\n?/gi, "");
  text = text.replace(/===+[^\n]*\n?/g, "");
  for (const line of code.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const re = new RegExp(`(?:^|\\n)==>\\s*${escapeRegExp(line)}\\r?\\n?`);
    text = text.replace(re, "\n");
  }
  text = text.replace(/^==>\s*.*$/gm, "");
  return text.trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
