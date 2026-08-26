# QR Transfer (Scan2)

**English** | [中文](#中文)

Transfer **any file** between devices using only QR codes — no Wi-Fi, no Bluetooth, no cable, no internet. Just point your camera and scan.

Works completely offline. Open a webpage, pick a file, and the data flows through a stream of QR codes at up to **1.6 KB/s**. The receiver scans them with a phone camera and reconstructs the original file, byte for byte.

## Why?

Sometimes the simplest channel is the most reliable. Air-gapped machines, locked-down networks, foreign hotel Wi-Fi you don't trust — QR Transfer gets your data across when nothing else can. No app install, no account, no pairing. It's just three HTML files.

## How Fast?

Each QR code carries a chunk of your data. At 10 codes/second (0.1s cycle):

| Error Correction | Data per QR | Throughput |
|-----------------|-------------|------------|
| H (highest) | ~52 bytes | ~0.5 KB/s |
| M (medium) | ~120 bytes | ~1.2 KB/s |
| L (lowest) | ~165 bytes | ~1.6 KB/s |

A 50 KB document transfers in under 30 seconds on M level. Not blazing fast, but when you have **zero network**, it's everything.

## Quick Start

### Online Demo
**[https://ttieli.github.io/Scan2/](https://ttieli.github.io/Scan2/)**

### Offline
1. Download `index.html`, `sender.html`, `receiver.html` — that's the whole app.
2. Open `sender.html` on the sending device. Pick a file or paste text.
3. Open `receiver.html` on the receiving device. Point the camera at the QR codes.
4. Done. The file is reconstructed and ready to download.

## Features

- **100% Offline** — no server, no network, no cloud. Data never leaves your devices.
- **Public Text QR** — plain UTF-8 QR codes that any standard scanner can read, split into readable numbered parts when needed.
- **Private Fast Transfer** — private text and files use the compact V2 sequence protocol for rapid continuous scanning and automatic reassembly.
- **Any File Type** — PDFs, images, code, zips, binaries, markdown, anything.
- **Smart Chunking** — files are automatically split into scannable QR code sequences.
- **Smart Retransmit** — missed a few QR codes? The receiver shows exactly which numbers are missing with a one-tap copy button. Paste them into the sender to replay only those fragments.
- **Session Recovery** — progress is saved automatically. Close the page, reopen, keep scanning.
- **Visual Progress Map** — see exactly which fragments have been received and which are missing.
- **Strong Integrity** — files and private text are verified with SHA-256 before completion; corrupted files cannot be downloaded.
- **Order Independent** — scanning may start at any fragment. The receiver keeps early data until metadata arrives and rejects fragments from other transfers.
- **Bilingual** — Chinese and English, auto-detected.

## Transfer Modes

| Data | Mode | Compatible Scanner | Behavior |
|---|---|---|---|
| Text | Public | Any QR scanner | Plain UTF-8 text; long content becomes independently readable numbered QR codes |
| Text | Private | QR Transfer receiver | Fast V2 sequence scanning, automatic reassembly, recovery, and retransmit |
| File | Private | QR Transfer receiver | V2 sequence scanning, SHA-256 verification, and download |

`sender.html` and `receiver.html` are each fully self-contained. Neither page needs a CDN, an external JavaScript file, a server, or a build step. Private V2 transfers have a stable transfer ID; while one transfer is active, fragments from other transfers are ignored until you choose **Start Over**.

### QR Display Size

Loop and Single modes share a 160–360px size slider in the fullscreen viewer. The default is 220px and the last choice is remembered. Grid mode is unchanged.

### Saving Received Files

- **Share / Save File** appears when the browser supports file sharing. On iPhone or iPad, choose **Save to Files** in the system share sheet.
- **Direct Download** is always available and keeps the received session so you can retry.
- **Open Preview** appears for PDF, text, image, audio, and video files.
- On iOS, downloads are normally in **Files → Downloads**. The exact location is controlled by **Settings → Apps → Safari → Downloads** and cannot be forced by a webpage.
- Other browsers may save automatically, ask for a destination, or open a supported file type. Check the browser download list or system file manager.

## How It Works

```
Sender                              Receiver
┌──────────────┐                    ┌──────────────┐
│  Pick a file │                    │ Point camera │
│      ↓       │                    │      ↓       │
│  Base64 encode│    QR codes       │  Scan & parse│
│      ↓       │  ──────────────►   │      ↓       │
│  Split into  │  (one by one)      │  Reassemble  │
│  fragments   │                    │  fragments   │
│      ↓       │                    │      ↓       │
│  QR sequence │                    │  Download ✓  │
└──────────────┘                    └──────────────┘
```

## Files

```
├── index.html        # Landing page
├── sender.html       # QR code generation (with embedded QRCode.js)
├── receiver.html     # Camera scanning & reassembly (with embedded jsQR)
├── test.html         # Automated E2E test suite
└── README.md
```

---

<a id="中文"></a>

# QR Transfer (Scan2)

[English](#qr-transfer-scan2) | **中文**

用二维码传输**任意文件** — 不需要 Wi-Fi，不需要蓝牙，不需要数据线，不需要互联网。对准摄像头扫一扫就行。

完全离线运行。打开网页，选个文件，数据就通过一连串二维码流出去，速率可达 **1.6 KB/s**。接收端用手机摄像头扫描，逐字节还原出原始文件。

## 为什么需要它？

有时候最简单的通道最可靠。断网的机房、管控严格的内网、你不信任的酒店 Wi-Fi — QR Transfer 在其他方式都不通的时候，帮你把数据送过去。不用装 App，不用注册账号，不用配对。整个应用就三个 HTML 文件。

## 传输速率

每张二维码承载一片数据。以每秒 10 张（0.1 秒/张）计算：

| 纠错等级 | 每张数据量 | 吞吐量 |
|---------|----------|--------|
| H（最高纠错） | ~52 字节 | ~0.5 KB/s |
| M（中等纠错） | ~120 字节 | ~1.2 KB/s |
| L（最低纠错） | ~165 字节 | ~1.6 KB/s |

一个 50 KB 的文档在 M 级别下不到 30 秒传完。速度不算飞快，但在**没有任何网络**的情况下，这就是一切。

## 快速开始

### 在线体验
**[https://ttieli.github.io/Scan2/](https://ttieli.github.io/Scan2/)**

### 离线使用
1. 下载 `index.html`、`sender.html`、`receiver.html` — 这就是整个应用。
2. 在发送设备上打开 `sender.html`，选文件或粘贴文本。
3. 在接收设备上打开 `receiver.html`，摄像头对准二维码。
4. 搞定。文件已还原，可以下载。

## 功能亮点

- **完全离线** — 没有服务器，没有网络，没有云端。数据不会离开你的设备。
- **公有文本二维码** — 使用原始 UTF-8 明文，任意标准二维码扫描器都能读取；长文本自动拆成带可读序号的多张二维码。
- **私有快速传输** — 私有文本和文件采用紧凑 V2 序列协议，可连续快速扫描并自动拼接。
- **支持任意文件** — PDF、图片、代码、压缩包、二进制、Markdown，随便什么都行。
- **智能分片** — 文件自动拆分为手机摄像头能可靠扫描的二维码序列。
- **智能补传** — 漏扫了几张？接收端直接显示缺失编号，一键复制，粘贴到发送端就只循环那几张。
- **断点续传** — 进度自动保存。关掉页面再打开，继续扫。
- **可视化进度** — 实时看到哪些片段已收到、哪些还缺。
- **强完整性校验** — 文件和私有文本完成前使用 SHA-256 校验；损坏文件不会开放下载。
- **不依赖扫描顺序** — 可以从任意片开始扫描；元数据晚到不会清空进度，其他传输的片段不会混入当前会话。
- **中英双语** — 自动检测语言，也可手动切换。

## 传输模式

| 数据 | 模式 | 支持的扫描器 | 行为 |
|---|---|---|---|
| 文本 | 公有 | 任意二维码扫描器 | 原始 UTF-8 明文；长内容拆成可独立读取、带序号的二维码 |
| 文本 | 私有 | QR Transfer 接收端 | V2 快速连续扫描、自动拼接、恢复和补传 |
| 文件 | 私有 | QR Transfer 接收端 | V2 连续扫描、SHA-256 校验和下载 |

`sender.html` 和 `receiver.html` 各自都是完整自包含页面，不需要 CDN、外部 JavaScript、服务器或构建步骤。私有 V2 传输使用稳定传输 ID；当前传输未结束时，其他传输的片段会被忽略，选择“重新开始”后才能切换。

### 二维码显示尺寸

循环播放和单张显示在全屏查看器中共用 160–360px 尺寸滑杆，默认 220px，并记住上次选择。网格平铺不受影响。

### 保存接收文件

- 浏览器支持文件分享时显示**分享 / 存储文件**。iPhone 或 iPad 可在系统分享面板中选择“存储到文件”。
- **直接下载**始终可用，而且不会清除已接收会话，可以重复尝试。
- PDF、文本、图片、音频和视频会额外显示**打开预览**。
- iOS 下载通常位于**文件 App → 下载项**；确切位置由“设置 → App → Safari → 下载项”决定，网页无法强制指定。
- 其他浏览器可能自动保存、询问目录或直接打开支持的文件类型，请检查浏览器下载列表或系统文件管理器。

## 工作原理

```
发送端                               接收端
┌──────────────┐                    ┌──────────────┐
│  选择文件     │                    │ 对准摄像头    │
│      ↓       │                    │      ↓       │
│  Base64 编码  │     二维码流        │  扫描解析     │
│      ↓       │  ──────────────►   │      ↓       │
│  拆分为片段   │   (逐张展示)        │  重组片段     │
│      ↓       │                    │      ↓       │
│  二维码序列   │                    │  下载文件 ✓   │
└──────────────┘                    └──────────────┘
```

## 文件结构

```
├── index.html        # 首页
├── sender.html       # 二维码生成（内嵌 QRCode.js）
├── receiver.html     # 摄像头扫描与数据还原（内嵌 jsQR）
├── test.html         # 自动化端到端测试
└── README.md
```
