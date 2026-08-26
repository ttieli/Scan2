# QR Transfer V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy private text/file QR format with a self-contained V2 protocol, preserve universally readable public text QR codes, and eliminate fragment-loss, cross-transfer, integrity, persistence, and filename-injection bugs.

**Architecture:** `sender.html` and `receiver.html` remain independent single-file applications. Each page owns an inline V2 core with an opt-in `?test=1` API; `test.html` loads those production pages in hidden same-origin iframes and tests their real protocol/state functions. Public text stays plain UTF-8 QR content, while private text and files use a compact JSON envelope with a stable transfer ID and SHA-256 metadata.

**Tech Stack:** Static HTML, browser JavaScript, embedded QRCode.js/jsQR, Web Crypto, FileReader, LocalStorage, browser-based E2E tests.

## Global Constraints

- `sender.html` and `receiver.html` must each remain fully self-contained and usable offline.
- No CDN, external JavaScript, ES Module import, backend, package manager, or build step may become a runtime dependency.
- Public text QR payloads must remain plain UTF-8 text readable by ordinary QR scanners.
- Old private text and file protocols are intentionally unsupported.
- Private V2 fragments use `v`, `k`, `x`, `i`, `t`, `d`, and optional metadata `m`; UI fragment numbers remain 1-based.
- No untrusted QR/file/session string may be interpolated into `innerHTML`.
- Existing user files and unrelated untracked worktree content must not be staged or modified.

---

### Task 1: Production-page test bridge and failing V2 contract tests

**Files:**
- Modify: `test.html`
- Test: `test.html`

**Interfaces:**
- Consumes: `window.QRSenderTestAPI` from `sender.html?test=1` and `window.QRReceiverTestAPI` from `receiver.html?test=1`.
- Produces: async regression tests T10-T18 that exercise production page APIs.

- [ ] **Step 1: Add hidden same-origin production frames and async API loader**

```html
<iframe id="senderTestFrame" src="sender.html?test=1" hidden></iframe>
<iframe id="receiverTestFrame" src="receiver.html?test=1" hidden></iframe>
```

```js
async function waitForProductionAPIs() {
    const senderWindow = document.getElementById('senderTestFrame').contentWindow;
    const receiverWindow = document.getElementById('receiverTestFrame').contentWindow;
    for (let attempt = 0; attempt < 100; attempt++) {
        if (senderWindow.QRSenderTestAPI && receiverWindow.QRReceiverTestAPI) {
            return { sender: senderWindow.QRSenderTestAPI, receiver: receiverWindow.QRReceiverTestAPI };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Production test APIs unavailable');
}
```

- [ ] **Step 2: Add failing production-contract tests**

Add tests with these exact assertions:

```js
const publicParts = sender.splitPublicText('你好🙂'.repeat(800), 'H');
assert(publicParts.length > 1);
assert(publicParts.every((part, index) => part.startsWith(`【QR文本 ${index + 1}/${publicParts.length}】\n`)));
assert(sender.splitPublicText('普通文本', 'H')[0] === '普通文本');

const fileTransfer = await sender.buildFileTransfer(new TextEncoder().encode('file bytes'), 'demo.txt', 'text/plain', 'H');
assert(fileTransfer.fragments.every(fragment => fragment.v === 2 && fragment.k === 'f'));
assert(fileTransfer.fragments.every(fragment => fragment.x === fileTransfer.id));

receiver.reset();
receiver.accept(fileTransfer.fragments[1]);
receiver.accept(fileTransfer.fragments[0]);
assert(receiver.snapshot().received.includes(1));

const other = await sender.buildFileTransfer(new TextEncoder().encode('other bytes'), 'other.txt', 'text/plain', 'H');
receiver.accept(other.fragments[1]);
assert(receiver.snapshot().id === fileTransfer.id);

receiver.renderRecoveryName('<img src=x onerror=alert(1)>');
assert(receiver.recoveryText().includes('<img'));
assert(!receiver.recoveryHTML().includes('<img'));
```

Also cover invalid indices/types, metadata-late persistence, restored state, digest mismatch, private text roundtrip, and byte-exact file roundtrip.

- [ ] **Step 3: Run the browser suite and verify RED**

Run a temporary loopback HTTP server and open `http://127.0.0.1:<port>/test.html`.

Expected: existing tests still execute, while the new contract tests fail because `QRSenderTestAPI` and `QRReceiverTestAPI` do not exist.

- [ ] **Step 4: Commit the failing tests**

```bash
git add -- test.html
git commit -m "test: add QR transfer V2 regressions"
```

---

### Task 2: Self-contained sender V2 and public text generation

**Files:**
- Modify: `sender.html`
- Test: `test.html`

**Interfaces:**
- Consumes: `File`, `Uint8Array`, error level `L|M|Q|H`.
- Produces: `sha256Hex(bytes)`, `splitPublicText(text, level)`, `buildPrivateTextTransfer(text, level)`, `buildFileTransfer(bytes, name, mime, level)`, and `window.QRSenderTestAPI` under `?test=1`.

- [ ] **Step 1: Implement byte and digest helpers**

```js
function utf8Bytes(value) { return new TextEncoder().encode(value); }
async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function bytesToBase64(bytes) {
    let result = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        result += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(result);
}
```

- [ ] **Step 2: Implement plain public text splitting**

`splitPublicText(text, level)` must return `[text]` when it fits. Otherwise it must repeatedly calculate the final `【QR文本 i/n】\n` prefix and split on Unicode code-point boundaries until every final part fits the selected QR capacity in UTF-8 bytes.

- [ ] **Step 3: Implement compact V2 fragment builders**

```js
async function buildFileTransfer(bytes, name, mime, level) {
    const contentHash = await sha256Hex(bytes);
    const idHash = await sha256Hex(utf8Bytes(name + '\0' + bytes.length + '\0' + contentHash));
    return buildV2Fragments('f', idHash.slice(0, 16), bytesToBase64(bytes), {
        n: name, y: mime || 'application/octet-stream', s: bytes.length, h: contentHash
    }, level);
}
```

`buildPrivateTextTransfer` uses UTF-8 bytes, content SHA-256, `k:'t'`, and metadata `{h,e:'utf8'}`. `buildV2Fragments` must find a safe Base64 chunk size by measuring each serialized fragment's actual UTF-8 byte length against the target QR capacity.

- [ ] **Step 4: Route the UI into the three approved modes**

Make `generateQR` async. Public text calls `splitPublicText` and encodes each returned string without percent encoding or JSON. Private text and file call the V2 builders and render their serialized fragments. File reading changes to `readAsArrayBuffer`; any QR generation failure aborts the complete set and leaves playback disabled.

- [ ] **Step 5: Register the sender test API only under `?test=1`**

```js
if (new URLSearchParams(location.search).get('test') === '1') {
    window.QRSenderTestAPI = Object.freeze({
        splitPublicText,
        buildPrivateTextTransfer,
        buildFileTransfer,
        sha256Hex
    });
}
```

- [ ] **Step 6: Run tests and verify sender GREEN**

Expected: public text and sender protocol tests pass; receiver contract tests remain red because the receiver API is not implemented.

- [ ] **Step 7: Commit sender implementation**

```bash
git add -- sender.html
git commit -m "feat: add self-contained QR transfer V2 sender"
```

---

### Task 3: Receiver V2 state machine, persistence, and safe rendering

**Files:**
- Modify: `receiver.html`
- Test: `test.html`

**Interfaces:**
- Consumes: parsed QR objects with V2 envelope fields.
- Produces: `validateV2Fragment`, `acceptV2Fragment`, `snapshotV2State`, `restoreV2Session`, `verifyV2Transfer`, and `window.QRReceiverTestAPI` under `?test=1`.

- [ ] **Step 1: Add strict V2 schema validation**

```js
function validateV2Fragment(value) {
    if (!value || value.v !== 2 || !['t', 'f'].includes(value.k)) return { ok: false, reason: 'version-or-kind' };
    if (!/^[0-9a-f]{16}$/.test(value.x)) return { ok: false, reason: 'transfer-id' };
    if (!Number.isInteger(value.i) || !Number.isInteger(value.t) || value.t < 2 || value.i < 0 || value.i >= value.t) return { ok: false, reason: 'index' };
    if (typeof value.d !== 'string') return { ok: false, reason: 'data' };
    if (value.i === 0 && !isValidMetadata(value.k, value.m)) return { ok: false, reason: 'metadata' };
    if (value.i !== 0 && value.m !== undefined) return { ok: false, reason: 'unexpected-metadata' };
    return { ok: true };
}
```

- [ ] **Step 2: Replace text/file globals with one active V2 state**

```js
let activeTransfer = null;

function acceptV2Fragment(fragment) {
    const validation = validateV2Fragment(fragment);
    if (!validation.ok) return { accepted: false, reason: validation.reason };
    if (!activeTransfer) activeTransfer = createV2State(fragment);
    if (activeTransfer.id !== fragment.x || activeTransfer.kind !== fragment.k || activeTransfer.total !== fragment.t) {
        return { accepted: false, reason: 'other-transfer' };
    }
    const duplicate = Object.prototype.hasOwnProperty.call(activeTransfer.fragments, fragment.i);
    activeTransfer.fragments[fragment.i] = fragment.d;
    if (fragment.i === 0) activeTransfer.metadata = fragment.m;
    activeTransfer.updatedAt = Date.now();
    saveV2Session(activeTransfer);
    return { accepted: true, duplicate };
}
```

The state must be created from any valid fragment, preserve data received before metadata, and refuse every foreign transfer until the user explicitly resets.

- [ ] **Step 3: Implement validated persistence and restoration**

Persist `{version:2,id,kind,total,fragments,metadata,createdAt,updatedAt}`. Loading must revalidate the session structure, each fragment index/data type, ID, kind, total, TTL, and metadata before accepting it. Invalid or legacy sessions are removed.

- [ ] **Step 4: Implement async completion verification**

Require metadata and every numeric index `0...total-1`. Decode Base64, check file byte length, decode text as fatal UTF-8, and compare SHA-256 to `m.h`. Hash mismatch returns a damaged result and must not enable download.

- [ ] **Step 5: Replace unsafe recovery rendering**

Build the recovery message from static elements and text nodes:

```js
message.replaceChildren();
const strong = document.createElement('strong');
strong.textContent = '已恢复文件传输：';
message.append(strong, document.createTextNode(' ' + fileName + ' - 已接收 ' + received + '/' + total + ' 片'));
```

Audit every file-name/MIME/session sink; any external value must use `textContent`, `value`, a text node, or the `download` property.

- [ ] **Step 6: Route scanned private fragments exclusively through V2**

The scanner accepts `data.v === 2 && (data.k === 't' || data.k === 'f')`. Legacy private objects are shown as unsupported and never enter session state. Plain non-JSON content remains readable as public text.

- [ ] **Step 7: Register the receiver test API under `?test=1`**

Expose reset, accept, snapshot, persist/restore, verify, and recovery rendering inspection functions. The API must not exist during a normal page load.

- [ ] **Step 8: Run all tests and verify GREEN**

Expected: all original applicable tests and T10-T18 pass, including metadata-late, foreign-transfer rejection, persistence, SHA-256 failure, injection safety, private text, and byte-exact file roundtrip.

- [ ] **Step 9: Commit receiver implementation**

```bash
git add -- receiver.html
git commit -m "fix: make QR transfer V2 reception robust"
```

---

### Task 4: Update browser E2E suite and documentation

**Files:**
- Modify: `test.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: final sender/receiver test APIs and UI terminology.
- Produces: one-click browser regression suite and accurate bilingual usage documentation.

- [ ] **Step 1: Remove obsolete copied legacy protocol tests**

Keep QR encode/decode coverage, but remove legacy file/text builders and Base31-era expectations. The final list must state which tests call production sender/receiver APIs.

- [ ] **Step 2: Update bilingual README**

Document public text, private text, private file, V2 transfer IDs, SHA-256 verification, arbitrary starting fragment, explicit reset before switching transfers, and the fact that both sender and receiver remain self-contained.

- [ ] **Step 3: Run the complete browser suite twice**

Expected: the same total passes twice, no warnings/errors, and no test depends on execution order or stale LocalStorage.

- [ ] **Step 4: Commit test and documentation updates**

```bash
git add -- test.html README.md
git commit -m "test: cover QR transfer V2 end to end"
```

---

### Task 5: Final production verification

**Files:**
- Verify: `sender.html`
- Verify: `receiver.html`
- Verify: `test.html`
- Verify: `README.md`

**Interfaces:**
- Consumes: final working tree.
- Produces: verification evidence only.

- [ ] **Step 1: Verify self-contained runtime**

Search both production HTML files for `<script src=`, dynamic imports, CDN URLs, and network APIs. Expected: no runtime dependency outside the HTML file itself.

- [ ] **Step 2: Verify JavaScript page health**

Load sender, receiver, and test pages over loopback HTTP and inspect console errors. Expected: no JavaScript errors before camera permission is requested.

- [ ] **Step 3: Verify production byte roundtrip**

Use `QRSenderTestAPI.buildFileTransfer` with deterministic random bytes, feed fragments to `QRReceiverTestAPI` in shuffled order with metadata last, verify, and compare every output byte. Expected: exact equality and SHA-256 match.

- [ ] **Step 4: Verify public QR compatibility**

Generate single- and multi-part public text using the production sender, encode with embedded QRCode.js, decode with embedded jsQR, and compare decoded payloads to the original plain strings.

- [ ] **Step 5: Verify security and negative paths**

Re-run malicious filename, foreign transfer, malformed fragment, persistence corruption, length mismatch, and SHA-256 mismatch tests. Expected: all rejected or rendered as plain text.

- [ ] **Step 6: Check diff and worktree ownership**

Run `git diff --check`, `git status --short`, and inspect the final diff. Expected: only the approved implementation files and plan/spec commits are changed; unrelated untracked files remain untouched.
