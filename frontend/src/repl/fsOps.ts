import type { MicroPythonRepl } from "./microPythonRepl";

export type FsEntry = {
  name: string;
  size: number | null;
  isDir: boolean;
};

function assertOk(stderr: string) {
  const s = stderr.trim();
  if (s) throw new Error(s);
}

export async function listFs(repl: MicroPythonRepl, path = "/"): Promise<FsEntry[]> {
  const code = `
import os, json
path = ${JSON.stringify(path)}
out = []
for name in os.listdir(path):
    full = path.rstrip("/") + "/" + name if path != "/" else "/" + name
    if path.endswith("/") and path != "/":
        full = path + name
    try:
        st = os.stat(full)
        # MicroPython: st[0] & 0x4000 => dir on some ports; also S_IFDIR=0o040000
        mode = st[0]
        is_dir = (mode & 0x4000) != 0 or (mode & 0o170000) == 0o040000
        size = st[6] if len(st) > 6 else None
        out.append({"name": name, "size": size, "isDir": bool(is_dir)})
    except Exception as e:
        out.append({"name": name, "size": None, "isDir": False, "err": str(e)})
print(json.dumps(out))
`;
  const { stdout, stderr } = await repl.runRaw(code.trim() + "\n");
  assertOk(stderr);
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? "[]";
  const parsed = JSON.parse(line) as Array<{ name: string; size: number | null; isDir: boolean }>;
  return parsed.map((x) => ({
    name: x.name,
    size: x.size,
    isDir: !!x.isDir,
  }));
}

export async function readFsText(repl: MicroPythonRepl, path: string): Promise<string> {
  const code = `
p = ${JSON.stringify(path)}
with open(p, "r") as f:
    print(f.read(), end="")
`;
  const { stdout, stderr } = await repl.runRaw(code.trim() + "\n");
  assertOk(stderr);
  return stdout;
}

export async function writeFsText(repl: MicroPythonRepl, path: string, content: string): Promise<void> {
  // 用 JSON 字符串字面量写入，避免转义地狱
  const code = `
p = ${JSON.stringify(path)}
data = ${JSON.stringify(content)}
with open(p, "w") as f:
    f.write(data)
print("wrote", len(data))
`;
  const { stderr } = await repl.runRaw(code.trim() + "\n");
  assertOk(stderr);
}

export async function writeFsBytes(repl: MicroPythonRepl, path: string, bytes: Uint8Array): Promise<void> {
  // 分块 base64，避免单行过长
  const CHUNK = 450;
  const b64chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    let bin = "";
    for (let j = 0; j < slice.length; j++) bin += String.fromCharCode(slice[j]!);
    b64chunks.push(btoa(bin));
  }

  const code = `
import ubinascii
p = ${JSON.stringify(path)}
parts = ${JSON.stringify(b64chunks)}
with open(p, "wb") as f:
    for part in parts:
        f.write(ubinascii.a2b_base64(part))
print("wrote", ${bytes.length})
`;
  const { stderr } = await repl.runRaw(code.trim() + "\n", 60000);
  assertOk(stderr);
}

export async function removeFs(repl: MicroPythonRepl, path: string): Promise<void> {
  const code = `
import os
os.remove(${JSON.stringify(path)})
print("removed")
`;
  const { stderr } = await repl.runRaw(code.trim() + "\n");
  assertOk(stderr);
}

