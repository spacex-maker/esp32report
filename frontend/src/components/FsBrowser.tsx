import { useCallback, useState } from "react";
import { FolderOpen, RefreshCw, Trash2, Upload, Eye } from "lucide-react";
import type { MicroPythonRepl } from "../repl/microPythonRepl";
import { listFs, readFsText, removeFs, writeFsBytes, writeFsText, type FsEntry } from "../repl/fsOps";

type Props = {
  connected: boolean;
  busy: boolean;
  repl: MicroPythonRepl | null;
  onMessage: (msg: string) => void;
};

export function FsBrowser({ connected, busy, repl, onMessage }: Props) {
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ path: string; text: string } | null>(null);
  const [newName, setNewName] = useState("hello.py");
  const [newBody, setNewBody] = useState('print("hi from browser")\n');

  const refresh = useCallback(async () => {
    if (!repl) return;
    setLoading(true);
    try {
      const list = await listFs(repl, "/");
      setEntries(list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)));
      onMessage(`已列出 / ：${list.length} 项`);
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repl, onMessage]);

  async function openFile(name: string) {
    if (!repl) return;
    setLoading(true);
    try {
      const path = "/" + name;
      const text = await readFsText(repl, path);
      setPreview({ path, text });
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteFile(name: string) {
    if (!repl) return;
    if (!confirm(`删除 /${name} ？`)) return;
    setLoading(true);
    try {
      await removeFs(repl, "/" + name);
      onMessage(`已删除 /${name}`);
      await refresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveNew() {
    if (!repl) return;
    const path = newName.startsWith("/") ? newName : "/" + newName;
    setLoading(true);
    try {
      await writeFsText(repl, path, newBody);
      onMessage(`已写入 ${path}`);
      await refresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function uploadBin(file: File | null) {
    if (!repl || !file) return;
    const path = "/" + file.name;
    setLoading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await writeFsBytes(repl, path, buf);
      onMessage(`已上传 ${path}（${buf.length} bytes）`);
      await refresh();
    } catch (err) {
      onMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const disabled = !connected || busy || !repl || loading;

  return (
    <section className="panel p-5 animate-fade-up" style={{ animationDelay: "150ms" }}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">板载文件系统</h2>
          <p className="mt-1 text-sm text-ink-700/75">
            通过 MicroPython REPL 管理 Flash 上的文件（如 boot.py / main.py）。
          </p>
        </div>
        <button type="button" className="btn-secondary" disabled={disabled} onClick={() => void refresh()}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-700/70">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">大小</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-ink-700/60">
                  点「刷新」列出文件
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.name} className="border-t border-ink-100">
                  <td className="px-3 py-2 font-mono text-[13px]">
                    <FolderOpen className="mr-1 inline h-3.5 w-3.5 text-board-600" />
                    {e.name}
                    {e.isDir ? "/" : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-700/80">
                    {e.isDir ? "—" : e.size == null ? "?" : `${e.size} B`}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!e.isDir ? (
                        <button
                          type="button"
                          className="btn-secondary !px-2 !py-1 text-xs"
                          disabled={disabled}
                          onClick={() => void openFile(e.name)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          查看
                        </button>
                      ) : null}
                      {!e.isDir ? (
                        <button
                          type="button"
                          className="btn-danger !px-2 !py-1 text-xs"
                          disabled={disabled}
                          onClick={() => void deleteFile(e.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {preview ? (
        <div className="mt-3">
          <div className="mb-1 text-xs font-medium text-ink-700/70">{preview.path}</div>
          <pre className="max-h-56 overflow-auto rounded-xl bg-ink-900 p-3 font-mono text-xs text-ink-50 whitespace-pre-wrap">
            {preview.text || "(空文件)"}
          </pre>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <label className="label" htmlFor="fs-name">
            新建 / 覆盖文本文件
          </label>
          <input
            id="fs-name"
            className="field mb-2 font-mono"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={disabled}
          />
          <textarea
            className="field min-h-[100px] font-mono"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
          <button type="button" className="btn-primary mt-2" disabled={disabled} onClick={() => void saveNew()}>
            保存到板子
          </button>
        </div>
        <div>
          <label className="label">上传任意文件</label>
          <label className={`btn-secondary cursor-pointer ${disabled ? "opacity-45" : ""}`}>
            <Upload className="h-4 w-4" />
            选择并上传
            <input
              type="file"
              className="hidden"
              disabled={disabled}
              onChange={(e) => void uploadBin(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="mt-2 text-xs text-ink-700/60">
            大文件会经 base64 分块写入，请保持连接稳定。写完后可用软重启让 main.py 生效。
          </p>
        </div>
      </div>
    </section>
  );
}
