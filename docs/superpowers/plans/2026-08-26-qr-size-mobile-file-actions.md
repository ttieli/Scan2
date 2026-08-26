# QR Size And Mobile File Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted 160–360px display-size control for loop/single QR modes and replace the unreliable one-shot Blob download with capability-based share, direct-download, and preview actions.

**Architecture:** Both production pages remain self-contained. `sender.html` applies a CSS-only display size without regenerating QR data; `receiver.html` builds one verified `File` and routes it through Web Share, delayed Blob download, or preview based on runtime capabilities and MIME. Existing `?test=1` production APIs expose deterministic helpers to `test.html` for RED/GREEN regression coverage.

**Tech Stack:** Static HTML/CSS/JavaScript, QRCode.js/jsQR, Web Crypto, Web Share API, Blob/Object URLs, LocalStorage, existing browser E2E suite.

## Global Constraints

- `sender.html` and `receiver.html` remain independent self-contained HTML files.
- Grid QR sizing remains unchanged; the shared loop/single fullscreen overlay is the sizing target.
- Loop and single modes share one 160–360px value, step 20px, default 220px.
- File operations never clear the verified transfer session automatically.
- Direct-download Object URLs remain alive for at least 60 seconds.
- Share uses capability detection and passes only `{ files: [file] }`.
- Preview appears only for PDF, text, image, audio, and video MIME types.
- No user or QR-derived value is interpolated into `innerHTML`.

---

### Task 1: Add failing production contract tests

**Files:**
- Modify: `test.html`

**Interfaces:**
- Consumes: future sender size API and receiver file-action API.
- Produces: T25–T29 regressions.

- [ ] **Step 1: Add QR size RED tests**

Add T25 and T26:

```js
requireCondition(sender.getDisplayQRSize() === 220, '默认尺寸不是220px');
requireCondition(sender.normalizeDisplayQRSize(100) === 160, '下限截断失败');
requireCondition(sender.normalizeDisplayQRSize(999) === 360, '上限截断失败');
requireCondition(sender.normalizeDisplayQRSize('bad') === 220, '非法值未回退');
sender.setDisplayQRSize(280);
requireCondition(sender.getDisplayQRSize() === 280, '尺寸未即时更新');
requireCondition(sender.getSizeControlState('grid').visible === false, '网格显示了尺寸控件');
requireCondition(sender.getSizeControlState('loop').visible === true, '循环未显示尺寸控件');
requireCondition(sender.getSizeControlState('single').visible === true, '单张未显示尺寸控件');
requireCondition(sender.loopUsesTransformScale() === false, '循环仍整体缩放卡片');
```

- [ ] **Step 2: Add file-action RED tests**

Add T27–T29:

```js
requireCondition(receiver.isPreviewableMime('application/pdf') === true);
requireCondition(receiver.isPreviewableMime('image/png') === true);
requireCondition(receiver.isPreviewableMime('application/zip') === false);

const actions = receiver.getFileActionAvailability('application/pdf', true);
requireCondition(actions.share && actions.download && actions.preview);
requireCondition(receiver.getObjectUrlCleanupDelay() >= 60000);

const file = receiver.createReceivedFileForTest('report.pdf', 'application/pdf', new Uint8Array([1, 2, 3]));
requireCondition(file.name === 'report.pdf' && file.type === 'application/pdf' && file.size === 3);

const trace = receiver.simulateDirectDownloadForTest(file);
requireCondition(trace.downloadName === 'report.pdf');
requireCondition(trace.cleanupDelay >= 60000);
requireCondition(trace.sessionCleared === false);
```

T29 must complete a production V2 file transfer through `receiver.handle`, then assert the share/download/preview buttons and platform hint reflect capability and MIME without losing the active state.

- [ ] **Step 3: Verify RED in the browser**

Run `test.html` over loopback HTTP.

Expected: existing 15 tests pass; T25–T29 fail because the new APIs do not exist.

- [ ] **Step 4: Commit failing tests**

```bash
git add -- test.html
git commit -m "test: add QR size and mobile file action regressions"
```

---

### Task 2: Implement persisted QR display sizing

**Files:**
- Modify: `sender.html`
- Test: `test.html`

**Interfaces:**
- Produces: `normalizeDisplayQRSize`, `setDisplayQRSize`, `getDisplayQRSize`, `getSizeControlState`, and corresponding sender test API entries.

- [ ] **Step 1: Add the display-size control UI**

Insert inside `#singleQRContainer`, above the loop/single navigation controls:

```html
<div id="qrSizeControl" class="qr-size-control" hidden>
  <label><span data-zh="二维码尺寸" data-en="QR Size">二维码尺寸</span> <output id="qrSizeValue">220px</output></label>
  <input id="qrSizeSlider" type="range" min="160" max="360" step="20" value="220" oninput="setDisplayQRSize(this.value)">
</div>
```

- [ ] **Step 2: Replace loop scaling with CSS sizing**

Remove `.loop-mode .qr-item { transform: scale(1.5); }`. Apply `--display-qr-size: 220px` to `#singleQRContent` and its QR canvas/img/svg, with width and height capped by both viewport axes. Keep the slider visible in the fullscreen overlay for loop/single; labels and controls remain unscaled.

- [ ] **Step 3: Implement normalized persisted state**

```js
const DISPLAY_QR_SIZE_KEY = 'qr_display_size';
const DISPLAY_QR_SIZE_DEFAULT = 220;

function normalizeDisplayQRSize(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DISPLAY_QR_SIZE_DEFAULT;
    const clamped = Math.min(360, Math.max(160, number));
    return Math.round(clamped / 20) * 20;
}
```

`setDisplayQRSize` updates the CSS property, slider, output and LocalStorage. Initialization loads and validates the stored value. Loop/single overlay entry shows the control; grid/overlay exit hides it.

- [ ] **Step 4: Extend `QRSenderTestAPI`**

Expose size normalization, get/set, control-state inspection and a CSS check proving loop mode no longer uses transform scaling.

- [ ] **Step 5: Run tests and verify size GREEN**

Expected: T25–T26 pass; T27–T29 remain red.

- [ ] **Step 6: Commit sender changes**

```bash
git add -- sender.html
git commit -m "feat: add adjustable QR display size"
```

---

### Task 3: Implement cross-browser received-file actions

**Files:**
- Modify: `receiver.html`
- Test: `test.html`

**Interfaces:**
- Produces: `createReceivedFile`, `isPreviewableMime`, `getFileActionAvailability`, `shareReceivedFile`, `downloadReceivedFile`, `previewReceivedFile`, delayed Object URL cleanup, and receiver test API entries.

- [ ] **Step 1: Replace the single download button with three actions**

```html
<div id="fileActionButtons">
  <button id="shareFileBtn" onclick="shareReceivedFile()" hidden>分享 / 存储文件</button>
  <button id="downloadBtn" onclick="downloadReceivedFile()">直接下载</button>
  <button id="previewFileBtn" onclick="previewReceivedFile()" hidden>打开预览</button>
</div>
<p id="fileActionHint"></p>
```

Use existing Apple-style colors: share is primary, direct download secondary, preview tertiary.

- [ ] **Step 2: Build one verified File with original metadata**

```js
function createReceivedFile() {
    if (!activeTransfer || !v2VerifiedResult || !v2VerifiedResult.ok) throw new Error('file-not-ready');
    return new File([v2VerifiedResult.bytes], activeTransfer.metadata.n, {
        type: activeTransfer.metadata.y || 'application/octet-stream'
    });
}
```

- [ ] **Step 3: Add capability and MIME routing**

`getFileActionAvailability(mime, shareSupported)` always enables download, enables preview only for approved MIME families, and enables share only when `navigator.canShare({files:[file]})` succeeds. Capability exceptions must fall back to `false`.

- [ ] **Step 4: Implement native share**

Call `navigator.share({ files: [file] })` directly from the click handler. Treat `AbortError` as cancellation. Keep the session for success, cancellation, and failure.

- [ ] **Step 5: Implement reliable direct download**

Create a Blob URL from the original `File`, click an anchor with `download=file.name`, set feedback to “已请求下载…”, remove the anchor after 1 second, and schedule URL revocation at 60 seconds. Track outstanding URLs in a Set and revoke them on `pagehide`. Do not call `clearSession()`.

- [ ] **Step 6: Implement preview**

For previewable MIME only, synchronously open a blank tab from the user click, assign the Blob URL, and retain it through the same delayed cleanup. If the popup is blocked, show an actionable message. Do not clear the session.

- [ ] **Step 7: Configure buttons after verification**

After a valid file completes, show share based on runtime capability, always show direct download, show preview based on MIME, and render the iOS/general location hint with text nodes only.

- [ ] **Step 8: Extend `QRReceiverTestAPI`**

Expose pure MIME/capability helpers, File construction, cleanup delay, a dependency-injected direct-download trace, and UI snapshot fields for all actions.

- [ ] **Step 9: Run all tests and verify GREEN**

Expected: T27–T29 pass and the entire suite is green with no console errors.

- [ ] **Step 10: Commit receiver changes**

```bash
git add -- receiver.html
git commit -m "fix: add reliable mobile file actions"
```

---

### Task 4: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `test.html`

**Interfaces:**
- Produces: accurate bilingual instructions and final repeatable suite.

- [ ] **Step 1: Update README**

Document adjustable loop/single sizing, the three file actions, Safari Files/Downloads location, capability-dependent share visibility, and the fact that webpages cannot force a system download directory.

- [ ] **Step 2: Run the browser suite twice**

Expected: identical pass totals twice; every icon green; no current-page console errors.

- [ ] **Step 3: Exercise production UI**

Verify the slider changes the shared loop/single fullscreen QR without regenerating payloads, grid remains unchanged, a completed PDF shows all applicable actions, a ZIP hides preview, and file actions preserve the active session.

- [ ] **Step 4: Run static gates**

Compile every inline script with `vm.Script`, run `git diff --check`, scan production pages for external runtime dependencies and untrusted `innerHTML`, and confirm tracked worktree cleanliness.

- [ ] **Step 5: Commit documentation/test cleanup**

```bash
git add -- README.md test.html
git commit -m "docs: explain QR sizing and mobile file saving"
```

- [ ] **Step 6: Final review**

Review the complete diff against `docs/superpowers/specs/2026-08-26-qr-display-size-design.md`. Critical or important findings must be fixed and reverified before handoff.
