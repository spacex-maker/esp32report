# ESP32 浏览器控制台

纯前端单页应用：通过 **Web Serial API** 在 Chrome / Edge 中完成 ESP32 芯片探测、固件烧录 / 整片备份、MicroPython REPL。

参考技术栈与目录风格来自同级项目 `aimatex-music`（Vite + React + TypeScript + Tailwind）。本仓库**无后端**——串口与烧录全部在浏览器内完成。

## 仓库结构

```
esp32report/
  frontend/                 # Vite + React + TS + Tailwind
    public/manifest.json    # esp-web-tools 默认清单
    src/
      serial/               # Web Serial 封装
      esp/                  # esptool-js：探测 / 烧录 / 备份
      repl/                 # MicroPython raw/paste REPL
      components/           # UI
  README.md
```

## 本地开发

```bash
cd frontend
npm install
npm run dev
```

用 **Chrome 或 Edge** 打开终端提示的地址（建议 `http://127.0.0.1:5173`）。

## 功能

| 模块 | 说明 |
|------|------|
| 连接管理 | `navigator.serial.requestPort()`，监听拔出，默认 115200 |
| 芯片探测 | esptool-js：型号 / MAC / Flash / eFuse 安全位 |
| 烧录 | `<esp-web-install-button>` + 自定义 `.bin`（esptool-js `writeFlash`） |
| 整片备份 | 按 64KB 分段 `readFlash`，拼 Blob 下载 |
| REPL | xterm.js + MicroPython raw REPL 执行片段 |

## 注意

- Firefox / Safari：页面会明确提示换浏览器，不会白屏崩溃。
- CP2102 等 USB 转串口需系统已有驱动；网页无法安装驱动。
- 探测 / 烧录 / 备份会复位板子；结束后会自动重开串口恢复 REPL。
- 使用 esp-web-tools 按钮前，若本页已占用串口会先断开，避免端口锁冲突。

## 参考

- [esptool-js](https://github.com/espressif/esptool-js)
- [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
- [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [MicroPython REPL](https://docs.micropython.org/en/latest/reference/repl.html)
