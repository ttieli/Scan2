# QR Code Protocol Specification

**Version**: 2.0.0
**Date**: 2025-10-13
**Feature**: 001-1-2
**Backward Compatibility**: YES (extends v1.x private text protocol)

---

## Overview

This specification defines the QR code generation and scanning protocols for both **Universal Mode** (standard QR) and **Private Mode** (custom chunked protocol).

---

## Protocol 1: Universal Mode (Standard QR)

**Purpose**: Generate standard QR codes compatible with third-party scanners (WeChat, Apple Camera, Alipay, etc.)

**Format**: Plain text UTF-8 encoding

**Characteristics**:
- No chunking
- No JSON wrapper
- No custom headers
- Single QR code per message
- Static display (no looping)

**Encoding Rules**:
1. Input text is encoded as UTF-8
2. If special characters cause scanner compatibility issues, apply percent-encoding (`encodeURIComponent`)
3. Display warning if encoding applied: "部分特殊字符已编码,可能在某些扫描器显示略有差异"
4. QR error correction level user-selectable (L/M/Q/H)

**Capacity Limits** (approximate, varies by error correction level):
- L (7% error correction): ~2953 bytes
- M (15% error correction): ~2331 bytes
- Q (25% error correction): ~1663 bytes
- H (30% error correction): ~1273 bytes

**Example**:
```
Input: "Hello World 你好世界"
QR Content (plain text): "Hello World 你好世界"
```

**Example with Encoding**:
```
Input: "Test<script>alert(1)</script>"
QR Content (percent-encoded): "Test%3Cscript%3Ealert(1)%3C%2Fscript%3E"
Warning Shown: YES
```

**Validation**:
```javascript
function validateUniversalMode(text) {
  const utf8Bytes = new TextEncoder().encode(text).length;
  const maxCapacity = getMaxCapacityForErrorLevel(errorLevel);

  if (utf8Bytes > maxCapacity) {
    return {
      valid: false,
      error: "文本过长,建议使用私有模式"
    };
  }

  return { valid: true };
}
```

---

## Protocol 2: Private Mode (Chunked Custom Protocol)

**Purpose**: Support long text and file transmission with chunking, looping playback, and session recovery

**Format**: JSON with custom structure

**Characteristics**:
- Supports chunking (multiple QR codes)
- JSON envelope with metadata
- Looping playback support
- Out-of-order fragment reception
- Session recovery via LocalStorage

### 2.1 Private Mode - Text

**JSON Structure**:
```json
{
  "type": "text",
  "index": 0,
  "total": 5,
  "data": "SGVsbG8gV29ybGQ="
}
```

**Field Definitions**:
- `type`: string, always "text" for text messages
- `index`: number, 0-based fragment index (0 to total-1)
- `total`: number, total fragment count
- `data`: string, Base64-encoded text fragment

**Chunking Algorithm**:
```javascript
function chunkTextMessage(text) {
  const base64Text = btoa(unescape(encodeURIComponent(text)));
  const fragmentSize = 2800; // Conservative capacity for JSON overhead
  const fragments = [];

  for (let i = 0; i < base64Text.length; i += fragmentSize) {
    const chunk = base64Text.substr(i, fragmentSize);
    fragments.push({
      type: "text",
      index: fragments.length,
      total: 0, // Will be set after loop
      data: chunk
    });
  }

  // Set total count
  fragments.forEach(f => f.total = fragments.length);

  return fragments;
}
```

**Example Multi-Fragment**:
```json
// Fragment 1/3
{
  "type": "text",
  "index": 0,
  "total": 3,
  "data": "VGhpcyBpcyB0aGUgZmlyc3QgcGFydCBvZiBhIGxvbmcgdGV4dC4="
}

// Fragment 2/3
{
  "type": "text",
  "index": 1,
  "total": 3,
  "data": "VGhpcyBpcyB0aGUgc2Vjb25kIHBhcnQuIEl0IGNvbnRpbnVlcy4="
}

// Fragment 3/3
{
  "type": "text",
  "index": 2,
  "total": 3,
  "data": "VGhpcyBpcyB0aGUgZmluYWwgcGFydCBvZiB0aGUgbWVzc2FnZS4="
}
```

### 2.2 Private Mode - File

**JSON Structure (First Fragment with Metadata)**:
```json
{
  "type": "file",
  "index": 0,
  "total": 10,
  "data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iag...",
  "metadata": {
    "fileName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSize": 102400,
    "checksum": "a3f5c8b9e1d2f4a7b8c9d0e1f2a3b4c5"
  }
}
```

**JSON Structure (Subsequent Fragments)**:
```json
{
  "type": "file",
  "index": 1,
  "total": 10,
  "data": "cGFnZXMgYW5kIHBhZ2VzIG9mIGRhdGE..."
}
```

**Field Definitions**:
- `type`: string, always "file" for file transfers
- `index`: number, 0-based fragment index
- `total`: number, total fragment count
- `data`: string, Base64-encoded file fragment
- `metadata`: object, ONLY present in first fragment (index 0)
  - `fileName`: string, original file name with extension
  - `mimeType`: string, MIME type (e.g., "application/pdf")
  - `fileSize`: number, original file size in bytes
  - `checksum`: string, SHA-256 hash of complete file for integrity verification

**Chunking Algorithm**:
```javascript
function chunkFile(file, base64Data) {
  // Remove data URL prefix
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');

  const fragmentSize = 2800;
  const fragments = [];
  const checksum = calculateSHA256(base64); // Implement SHA-256

  for (let i = 0; i < base64.length; i += fragmentSize) {
    const chunk = base64.substr(i, fragmentSize);
    const fragment = {
      type: "file",
      index: fragments.length,
      total: 0,
      data: chunk
    };

    // Add metadata to first fragment only
    if (fragment.index === 0) {
      fragment.metadata = {
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        checksum: checksum
      };
    }

    fragments.push(fragment);
  }

  // Set total count
  fragments.forEach(f => f.total = fragments.length);

  return fragments;
}
```

---

## Protocol 3: Session Recovery (LocalStorage)

**Purpose**: Persist transfer sessions across browser restarts

**Storage Key**: `qr_transfer_session`

**JSON Structure**:
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "timestamp": 1696320000000,
  "ttl": 86400000,
  "metadata": {
    "totalFragments": 5
  },
  "fragments": {
    "0": "SGVsbG8gV29ybGQ=",
    "2": "VGhpcyBpcyBhIGZyYWdtZW50",
    "4": "RW5kIG9mIG1lc3NhZ2U="
  },
  "receivedCount": 3,
  "status": "in_progress"
}
```

**Field Definitions**:
- `sessionId`: string, UUID v4 identifier
- `type`: string, "text" or "file"
- `timestamp`: number, Unix timestamp in milliseconds
- `ttl`: number, time-to-live in milliseconds (86400000 = 24 hours)
- `metadata`: object
  - For text: `{ totalFragments: number }`
  - For file: `{ fileName, mimeType, fileSize, totalFragments, checksum }`
- `fragments`: object, map of `index` (string) → `data` (base64 string)
- `receivedCount`: number, count of unique fragments received
- `status`: string, "in_progress" or "completed"

**TTL Rules**:
- Sessions expire after 24 hours (86400000 ms)
- Expired sessions are auto-deleted on page load
- User can manually clear session via "重新开始" button

**Recovery Behavior**:
```javascript
// On receiver.html page load
function checkSessionRecovery() {
  const session = loadSession(); // From localStorage

  if (!session) {
    // No session or expired
    showCleanUI();
    return;
  }

  // Session exists and valid
  showRecoveryBanner(session);
}

function showRecoveryBanner(session) {
  const message = session.type === "file"
    ? `已恢复文件传输: ${session.metadata.fileName} 已接收${session.receivedCount}/${session.metadata.totalFragments}片`
    : `已恢复传输会话: 已接收${session.receivedCount}/${session.metadata.totalFragments}片`;

  banner.textContent = message;
  banner.style.display = "block";

  // Provide "重新开始" button
  resetButton.onclick = () => {
    clearSession();
    location.reload();
  };
}
```

---

## Protocol Version Compatibility

| Version | Features | Backward Compatible |
|---------|----------|---------------------|
| 1.0 | Private text only (JSON chunked) | N/A (baseline) |
| 2.0 | + Universal mode<br>+ File transfer<br>+ Session recovery | ✅ YES (v1.0 text fragments still work) |

**Compatibility Rules**:
- v2.0 receiver can scan v1.0 text fragments (type="text", no metadata field)
- v1.0 receiver cannot scan v2.0 file fragments (will ignore type="file")
- v1.0 receiver cannot scan universal mode (plain text, no JSON)

---

## Error Handling

### Sender-Side Errors

**Universal Mode**:
```javascript
// Text too long
if (textByteLength > maxCapacity) {
  showError("文本过长,建议使用私有模式");
  disableGenerateButton();
}

// Special characters detected
if (containsProblematicChars(text)) {
  applyPercentEncoding(text);
  showWarning("部分特殊字符已编码,可能在某些扫描器显示略有差异");
}
```

**Private Mode - File**:
```javascript
// File size estimation warning
const estimate = estimateQRCount(file);
if (estimate.qrCount > 100) {
  showWarning(`预计生成${estimate.qrCount}个二维码,扫描需约${estimate.scanTime}分钟,建议压缩文件以减少二维码数量`);
}

// Executable file warning
if (isExecutableFile(file.name)) {
  showWarning("检测到可执行文件类型,请确认文件来源安全");
}
```

### Receiver-Side Errors

**Invalid JSON**:
```javascript
try {
  const fragment = JSON.parse(qrData);
} catch (e) {
  // Not a private mode QR, might be universal mode or invalid
  showError("无法解析二维码数据");
  return;
}
```

**Missing Fragment**:
```javascript
if (session.receivedCount < session.metadata.totalFragments) {
  const missing = findMissingFragments(session);
  showProgress(`已接收${session.receivedCount}/${session.metadata.totalFragments}片，缺失: ${missing.join(', ')}`);
}
```

**Checksum Mismatch**:
```javascript
const reassembled = reassembleFragments(session);
const calculatedChecksum = calculateSHA256(reassembled);

if (calculatedChecksum !== session.metadata.checksum) {
  showError("文件完整性校验失败，请重新扫描");
  clearSession();
}
```

---

## Summary

| Protocol | Use Case | Format | Chunking | Recovery |
|----------|----------|--------|----------|----------|
| Universal | Quick text share via third-party scanner | Plain text UTF-8 | NO | NO |
| Private Text | Long text transfer within app | JSON chunked | YES | YES |
| Private File | File transfer within app | JSON chunked + metadata | YES | YES |

**Next Document**: quickstart.md for developer implementation guidance.
