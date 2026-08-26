# Large File Bounded-Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep sender and receiver responsive for files through 20MiB by eliminating all-fragment DOM/Canvas creation, O(n²) receiver work, and full-session LocalStorage rewrites, while rejecting larger files before reading.

**Architecture:** The sender replaces `qrCodes[]` with a `QRSource` interface and lazily serializes V2 file fragments; grid rendering is paginated and fullscreen rendering is one-at-a-time with an eight-entry LRU. The receiver uses a compact bitset and received counter, aggregates large progress into 200 buckets, stores large file fragments in IndexedDB behind a bounded async queue, and retains the existing in-memory path for small tests/text.

**Tech Stack:** Static HTML/JavaScript, FileReader, Web Crypto, IndexedDB, LocalStorage session headers, QRCode.js/jsQR, existing iframe production test APIs.

## Global Constraints

- Hard maximum file size is exactly `20 * 1024 * 1024` bytes and is checked before FileReader/SHA/Base64.
- Files above 5MiB and at most 20MiB use L correction and require explicit confirmation.
- V2 QR wire fields remain unchanged.
- Sender grid has at most 12 rendered QR items; fullscreen has one; image cache has at most eight.
- Receiver large progress has at most 200 buckets.
- Receiver scan hot path has O(1) duplicate/count operations and never serializes all fragment data to LocalStorage.
- `sender.html` remains a fully self-contained offline file: no `<script src>`, CDN, dynamic `import()`, `fetch()`, external Worker, server, adjacent runtime asset, or build dependency.
- `receiver.html` also remains self-contained.

---

### Task 1: Add failing large-file structural tests

**Files:**
- Modify: `test.html`

**Interfaces:**
- Consumes: future `QRSenderTestAPI` and `QRReceiverTestAPI` large-file helpers.
- Produces: T30–T37 regressions.

- [ ] **Step 1: Add sender policy/source tests**

```js
const fiveMiB = 5 * 1024 * 1024;
const twentyMiB = 20 * 1024 * 1024;
requireCondition(sender.getFilePolicy(fiveMiB, 'H').accepted === true);
requireCondition(sender.getFilePolicy(fiveMiB + 1, 'H').effectiveLevel === 'L');
requireCondition(sender.getFilePolicy(twentyMiB, 'Q').effectiveLevel === 'L');
requireCondition(sender.getFilePolicy(twentyMiB + 1, 'L').accepted === false);

const sourceStats = sender.simulateLazyFileSource(fiveMiB, 'H');
requireCondition(sourceStats.total > 100000);
requireCondition(sourceStats.materializedFragments === 0);
requireCondition(sourceStats.getPayloadCalls === 0);
```

- [ ] **Step 2: Add sender renderer/range tests**

Assert grid rendering never exceeds 12 items, 1000 fullscreen accesses leave cache size at most eight, range input `1-20, 45, 90-92` expands correctly, and invalid/reversed/out-of-range ranges are rejected.

- [ ] **Step 3: Add receiver bitset/progress tests**

Create a 134,434-fragment large state, mark duplicates/new indices, and assert `receivedCount`, bitset bytes, and progress bucket count without a fragment object. Render the progress map and assert at most 200 `.map-item` nodes.

- [ ] **Step 4: Add IndexedDB and recovery tests**

Using a test database name, store fragments out of order, flush the queue, restore the session header/bitset, retrieve ordered values, clear the transfer, and assert no records remain. Simulate unavailable IndexedDB and assert the receiver stops instead of using full LocalStorage data.

- [ ] **Step 5: Add hard-limit pre-read test**

Expose `validateFileBeforeRead(size)` and assert 20MiB+1 fails before a supplied read spy is invoked.

- [ ] **Step 6: Verify RED and commit**

Expected: existing 20 pass; T30–T37 fail for missing APIs.

```bash
git add -- test.html
git commit -m "test: add bounded-memory large file regressions"
```

---

### Task 2: Implement sender lazy fragment sources and hard limit

**Files:**
- Modify: `sender.html`
- Test: `test.html`

**Interfaces:**
- Produces: `getFilePolicy`, `validateFileBeforeRead`, `createLazyV2FileSource`, `createArrayQRSource`, `currentQRSource`, and source accessors.

- [ ] **Step 1: Add constants and preflight policy**

```js
const NORMAL_FILE_MAX_BYTES = 5 * 1024 * 1024;
const ABSOLUTE_FILE_MAX_BYTES = 20 * 1024 * 1024;

function getFilePolicy(size, selectedLevel) {
    if (!Number.isFinite(size) || size < 0 || size > ABSOLUTE_FILE_MAX_BYTES) return { accepted: false, reason: 'file-too-large' };
    const longMode = size > NORMAL_FILE_MAX_BYTES;
    return { accepted: true, longMode, effectiveLevel: longMode ? 'L' : selectedLevel, requiresConfirmation: longMode };
}
```

Apply at file selection, drop, estimate, and `generateFileQR` before `readAsArrayBuffer`.

- [ ] **Step 2: Compute lazy chunk layout**

Replace candidate full-array creation with `calculateV2Layout(kind, id, base64Length, metadata, level)`. It iterates chunk size using only a worst-case sample JSON and returns `{chunkSize,total}`.

- [ ] **Step 3: Implement QRSource**

Array source exposes `{length,getData(index),getMetadata(index),materializedCount}`. Lazy file source stores Base64/layout and synthesizes metadata/data fragments on demand. `getData` validates index and returns `JSON.stringify(fragment)`.

- [ ] **Step 4: Add chunked preprocessing UI**

Add progress text/bar and cancel button. Convert bytes to Base64 in three-byte-aligned batches, yielding with `setTimeout(0)` between batches. Clear intermediate references on cancel/failure.

- [ ] **Step 5: Route generated text/file through currentQRSource**

Public/private text use array source. File generation uses lazy source. Preserve V2 payload bytes and SHA-256.

- [ ] **Step 6: Extend sender test API and verify GREEN**

Expose policy/layout/source simulation without allocating full test files. Expected: policy/source/hard-limit tests pass; renderer tests remain red.

- [ ] **Step 7: Commit**

```bash
git add -- sender.html
git commit -m "perf: add lazy large-file fragment sources"
```

---

### Task 3: Implement virtual grid and bounded fullscreen cache

**Files:**
- Modify: `sender.html`
- Test: `test.html`

**Interfaces:**
- Produces: `getQRCount`, `getQRData`, `renderGridPage`, `setGridPage`, bounded LRU cache, range-aware retransmit parser.

- [ ] **Step 1: Add grid pagination controls**

Add Previous/Next, page number, total pages, and “12 per page” status. Hide pagination when one page.

- [ ] **Step 2: Replace qrCodes reads**

All count/data/index/range/loop/single methods call source accessors. `qrCodes` remains only as a compatibility alias for small array sources and cannot be used by file generation.

- [ ] **Step 3: Render only one grid page**

Destroy the previous page DOM, render at most 12 QR containers, and retain logical global indices in labels/controls.

- [ ] **Step 4: Bound fullscreen cache**

Use `Map` as an eight-entry LRU of data URLs. Access refreshes recency; adding entry nine evicts the oldest. Loop/single always render one QR.

- [ ] **Step 5: Add numeric range parsing**

Support comma/space/Chinese separators plus `start-end`; deduplicate/sort and cap expansion to the source count. Reject malformed/reversed ranges.

- [ ] **Step 6: Verify and commit**

Expected: sender large-file and renderer/range tests pass; complete legacy suite remains green.

```bash
git add -- sender.html
git commit -m "perf: virtualize QR rendering and cache"
```

---

### Task 4: Implement receiver O(1) state and aggregate progress

**Files:**
- Modify: `receiver.html`
- Test: `test.html`

**Interfaces:**
- Produces: bitset helpers, `receivedCount`, `storageMode`, `updateV2ProgressMap`, missing-range compression.

- [ ] **Step 1: Add bitset state**

```js
function createReceivedBits(total) { return new Uint8Array(Math.ceil(total / 8)); }
function hasReceived(bits, index) { return (bits[index >> 3] & (1 << (index & 7))) !== 0; }
function markReceived(bits, index) { const had = hasReceived(bits,index); bits[index >> 3] |= 1 << (index & 7); return !had; }
```

State holds bits/count and uses `storageMode:'memory'` for text/small tests or `'idb'` for file totals above 2000. The hot path updates count only when `markReceived` returns true.

- [ ] **Step 2: Preserve small compatibility**

Small memory sessions may retain `fragments` for current tests. Snapshot received indices derive from bitset. Large sessions never create a fragments object.

- [ ] **Step 3: Aggregate progress**

For total >200, create exactly 200 or fewer bucket nodes and fixed bucket counters. Each fragment updates only its bucket. Small sessions retain per-fragment cells.

- [ ] **Step 4: Add missing range compression**

Walk bitset in yielded batches and produce inclusive ranges. UI displays/copies compact ranges; sender parser from Task 3 accepts them.

- [ ] **Step 5: Replace Object.keys hot-path calls**

V2 accept/handle/progress/recovery uses `receivedCount`; whole-session iteration is allowed only during explicit snapshot/export/verification for small memory sessions.

- [ ] **Step 6: Verify and commit**

```bash
git add -- receiver.html
git commit -m "perf: bound receiver progress and counting"
```

---

### Task 5: Implement IndexedDB large fragment storage

**Files:**
- Modify: `receiver.html`
- Test: `test.html`

**Interfaces:**
- Produces: `openFragmentDB`, `enqueueFragmentWrite`, `flushFragmentWrites`, `loadOrderedFragments`, `deleteTransferRecords`, compact large-session headers.

- [ ] **Step 1: Create database and stores**

Open `qr-transfer-v2` version 1 with `sessions` keyed by `id` and `fragments` keyed by `[id,index]`; add an `id` index for deletion/range access.

- [ ] **Step 2: Add bounded write queue**

Serialize puts through one Promise chain. Track pending count; above 50 return backpressure so scanner skips frames. Failed writes set a terminal persistence error and stop file scanning.

- [ ] **Step 3: Persist compact headers**

Large header includes metadata, total, count, status, timestamps, and Base64-encoded bitset, never fragment payloads. Save at most once per second or every 100 new fragments.

- [ ] **Step 4: Restore and clear**

Restore header/bitset without loading fragments. Clear removes session and all fragment rows by ID. Reset awaits cleanup best-effort and blocks new transfer reuse until scheduled.

- [ ] **Step 5: Verify large transfer**

Flush queue, confirm every expected index exists, read ordered fragment values in batches, join/decode/hash with progress yields, and preserve verified File actions.

- [ ] **Step 6: Extend test API, verify and commit**

Use a separate test DB name and cleanup after each test. Expected: all T30–T37 and existing tests pass.

```bash
git add -- receiver.html
git commit -m "perf: persist large transfers in IndexedDB"
```

---

### Task 6: Documentation and final performance gates

**Files:**
- Modify: `README.md`
- Modify: `test.html`

- [ ] **Step 1: Document limits and duration**

Explain 5MiB normal support, 5–20MiB L-only long mode, 20MiB rejection, paginated sender grid, IndexedDB recovery, and multi-hour scan expectations.

- [ ] **Step 2: Run structural 5MiB/20MiB benchmarks**

Assert no fragment array, ≤12 grid canvases, ≤8 cache items, ≤200 receiver buckets, and no full payload in large LocalStorage headers.

- [ ] **Step 3: Run complete browser suite twice**

Both runs must have identical totals, all green icons, visible final summary, and no current-page errors/warnings.

- [ ] **Step 4: Run production health/static checks**

Compile inline scripts, scan untrusted `innerHTML`, run `git diff --check`, and inspect tracked worktree status. Copy `sender.html` alone into a temporary empty directory, serve it without any neighboring project file, and verify file selection/preflight plus public/private text generation load without network requests. Static scan must reject `<script src>`, CDN URLs, dynamic import, fetch, and Worker construction.

- [ ] **Step 5: Commit docs/tests**

```bash
git add -- README.md test.html
git commit -m "docs: explain bounded-memory file limits"
```

- [ ] **Step 6: Final local review**

Review against `docs/superpowers/specs/2026-08-26-large-file-bounded-memory-design.md`; fix Critical/Important findings before handoff.
