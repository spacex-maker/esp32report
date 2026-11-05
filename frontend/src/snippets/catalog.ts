export type Snippet = {
  id: string;
  title: string;
  tag: string;
  blurb: string;
  code: string;
};

export const SNIPPETS: Snippet[] = [
  {
    id: "hello",
    title: "Hello MicroPython",
    tag: "入门",
    blurb: "确认 REPL 正常",
    code: `print("Hello ESP32")
print(1 + 1)
`,
  },
  {
    id: "sysinfo",
    title: "系统信息",
    tag: "诊断",
    blurb: "版本 / 芯片 / 频率 / 唯一 ID",
    code: `import sys, os, machine, gc
gc.collect()
print("version:", sys.version)
print("uname:", os.uname())
print("freq:", machine.freq())
print("unique_id:", machine.unique_id().hex())
print("free RAM:", gc.mem_free())
`,
  },
  {
    id: "led-gpio2",
    title: "闪可编程 LED (GPIO2)",
    tag: "GPIO",
    blurb: "电源灯控不了；试板载可编程灯",
    code: `from machine import Pin
import time
led = Pin(2, Pin.OUT)
for i in range(10):
    led.value(1)
    time.sleep(0.5)
    led.value(0)
    time.sleep(0.5)
print("done GPIO2")
`,
  },
  {
    id: "led-scan",
    title: "自动试常见 LED 脚",
    tag: "GPIO",
    blurb: "2/5/18/22/4 各闪三下",
    code: `from machine import Pin
import time
for gpio in (2, 5, 18, 22, 4):
    print("try GPIO", gpio)
    led = Pin(gpio, Pin.OUT)
    for _ in range(3):
        led.on(); time.sleep(0.2)
        led.off(); time.sleep(0.2)
print("scan done")
`,
  },
  {
    id: "wifi-scan",
    title: "扫描附近 WiFi",
    tag: "网络",
    blurb: "列出 SSID / 信号 / 信道",
    code: `import network
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
nets = wlan.scan()
print("found", len(nets))
for ssid, bssid, channel, rssi, auth, hidden in sorted(nets, key=lambda x: x[3], reverse=True):
    name = ssid.decode() if isinstance(ssid, (bytes, bytearray)) else ssid
    print("%4d  ch%-2d  %s" % (rssi, channel, name))
`,
  },
  {
    id: "wifi-connect",
    title: "连接 WiFi（改账号）",
    tag: "网络",
    blurb: "改 SSID/密码后执行，打印 IP",
    code: `import network, time
SSID = "你的WiFi"
PASSWORD = "密码"

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
if not wlan.isconnected():
    wlan.connect(SSID, PASSWORD)
    for i in range(30):
        if wlan.isconnected():
            break
        print("connecting...", i)
        time.sleep(0.5)
print("connected:", wlan.isconnected())
print("ifconfig:", wlan.ifconfig())
`,
  },
  {
    id: "temp",
    title: "内部温度（粗略）",
    tag: "传感器",
    blurb: "esp32.raw_temperature()",
    code: `import esp32
print("raw_temperature:", esp32.raw_temperature())
`,
  },
  {
    id: "hall",
    title: "霍尔传感器",
    tag: "传感器",
    blurb: "靠近磁铁数值会变",
    code: `import esp32, time
for i in range(20):
    print(i, esp32.hall_sensor())
    time.sleep(0.2)
`,
  },
  {
    id: "fs-list",
    title: "列出 Flash 文件",
    tag: "文件",
    blurb: "看 / 目录与容量",
    code: `import os, gc
gc.collect()
print("listdir:", os.listdir("/"))
st = os.statvfs("/")
block = st[0] * st[2]
free = st[0] * st[3]
print("flash total ~", block, "bytes; free ~", free, "bytes")
`,
  },
  {
    id: "http-hello",
    title: "迷你 HTTP 服务",
    tag: "网络",
    blurb: "需已连 WiFi；只响应一次请求",
    code: `import network, socket
wlan = network.WLAN(network.STA_IF)
if not wlan.isconnected():
    raise SystemExit("请先连接 WiFi")
ip = wlan.ifconfig()[0]
print("open http://%s/" % ip)
html = b"HTTP/1.0 200 OK\\r\\nContent-Type: text/html; charset=utf-8\\r\\n\\r\\n<h1>Hello ESP32</h1>"
s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("", 80))
s.listen(1)
conn, addr = s.accept()
print("client", addr)
conn.recv(1024)
conn.send(html)
conn.close()
s.close()
print("done")
`,
  },
  {
    id: "progress",
    title: "终端进度条彩蛋",
    tag: "趣味",
    blurb: "纯打印动画",
    code: `import time, urandom
for i in range(21):
    bar = "#" * i + "-" * (20 - i)
    print("\\r[%s] %3d%%" % (bar, i * 5), end="")
    time.sleep(0.05 + urandom.getrandbits(3) / 100)
print()
print("done")
`,
  },
  {
    id: "ctrlc-demo",
    title: "死循环（测 Ctrl+C）",
    tag: "趣味",
    blurb: "跑起来后点中断",
    code: `import time
n = 0
while True:
    print("tick", n, time.ticks_ms())
    n += 1
    time.sleep(0.5)
`,
  },
];
