# QR Transfer (Scan2)

**English** | [中文](#中文)

A purely offline data transfer solution using QR codes. No network required.

## Architecture

Three static HTML files, zero external dependencies (all libraries embedded).

- **`index.html`** — Landing page linking to Sender and Receiver.
- **`sender.html`** — Encodes text or files into a sequence of QR codes.
  - Files: binary → Base64 → chunked JSON fragments.
  - Fragment 0: metadata only (filename, size, checksum). Fragment 1+: data chunks.
  - Display modes: Grid, Loop (auto-cycle), Single (fullscreen).
  - Retransmit code input: enter a code from the receiver to loop only missing fragments.
- **`receiver.html`** — Scans QR codes via camera and reassembles data.
  - Parses custom JSON protocol, reassembles chunks in memory.
  - Visual progress grid map showing received/missing/just-scanned fragments.
  - Retransmit code generation: produces a compact Base31 code encoding missing fragment indices.
  - Auto-saves progress to `localStorage` for session recovery.

## Quick Start

### Online
Visit: **[https://ttieli.github.io/Scan2/](https://ttieli.github.io/Scan2/)**

### Offline
1. Download `index.html`, `sender.html`, and `receiver.html`.
2. Open `index.html` in any modern browser.
3. **Sender**: choose a file or enter text, generate QR codes.
4. **Receiver**: open on a mobile device, grant camera permission, scan.

## Features

- **100% Offline** — works in air-gapped environments.
- **Any File Type** — images, PDFs, zips, binaries, etc.
- **Auto Chunking** — large files split into scannable QR code sequences.
- **Retransmit Code** — receiver generates a short code for missing fragments; sender loops only those.
- **Session Recovery** — progress saved automatically; resume after page reload.
- **Visual Progress** — realtime grid map of received/missing chunks.
- **Bilingual UI** — Chinese/English, auto-detected with manual toggle.

## File Structure

```
├── index.html        # Landing page
├── sender.html       # QR code generation
├── receiver.html     # Camera scanning & reassembly
├── test.html         # Automated E2E tests
└── README.md
```

---

<a id="中文"></a>

# QR Transfer (Scan2)

[English](#qr-transfer-scan2) | **中文**

纯离线二维码数据传输工具，无需网络。

## 架构

三个静态 HTML 文件，零外部依赖（所有库内嵌）。

- **`index.html`** — 首页，链接到发送端和接收端。
- **`sender.html`** — 将文本或文件编码为二维码序列。
  - 文件：二进制 → Base64 → 分片 JSON。
  - 片段 0：仅元数据（文件名、大小、校验和）。片段 1+：数据分片。
  - 显示模式：平铺、循环播放（自动轮换）、单张（全屏）。
  - 补传码输入：输入接收端生成的编码，仅循环缺失片段。
- **`receiver.html`** — 通过摄像头扫描二维码并还原数据。
  - 解析自定义 JSON 协议，内存中重组分片。
  - 可视化进度地图，显示已收/缺失/刚扫描的片段。
  - 补传码生成：生成紧凑的 Base31 编码，包含缺失片段索引。
  - 自动保存进度到 `localStorage`，支持断点续传。

## 快速开始

### 在线使用
访问：**[https://ttieli.github.io/Scan2/](https://ttieli.github.io/Scan2/)**

### 离线使用
1. 下载 `index.html`、`sender.html` 和 `receiver.html`。
2. 用浏览器打开 `index.html`。
3. **发送端**：选择文件或输入文本，生成二维码。
4. **接收端**：在手机上打开，授权摄像头，扫描。

## 功能特性

- **完全离线** — 适用于断网环境。
- **支持任意文件** — 图片、PDF、压缩包、二进制等。
- **自动分片** — 大文件自动拆分为可扫描的二维码序列。
- **补传码** — 接收端生成缺失片段编码，发送端仅循环播放缺失部分。
- **断点续传** — 进度自动保存，刷新页面可恢复。
- **可视化进度** — 实时进度地图显示接收状态。
- **中英双语** — 自动检测语言，可手动切换。

## 文件结构

```
├── index.html        # 首页
├── sender.html       # 二维码生成
├── receiver.html     # 摄像头扫描与数据还原
├── test.html         # 自动化端到端测试
└── README.md
```
