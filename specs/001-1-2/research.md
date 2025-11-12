# Research: QR传输工具增强 - Technical Decisions

**Date**: 2025-10-13
**Feature**: 001-1-2
**Purpose**: Research QR libraries, browser APIs, and encoding strategies for universal QR mode and file transfer

---

## Decision 1: QR Code Generation Library

**Decision**: Use existing embedded qrcode.js library (already in sender.html), extend usage for both universal and private modes

**Rationale**:
- Already embedded inline in current sender.html (~20KB minified)
- Supports standard QR Code format (ISO/IEC 18004)
- Allows control over error correction levels (L/M/Q/H)
- Compatible with all modern browsers
- No additional dependencies needed

**Alternatives Considered**:
- **qrcodegen**: Smaller footprint (~10KB) but would require replacing existing library, breaking existing private mode
- **node-qrcode**: Server-side library, not suitable for browser embedding
- **QRious**: Similar size but less configuration flexibility for error correction levels

**Implementation Notes**:
- Use plain text input for universal mode (no JSON wrapping)
- Use existing JSON protocol for private mode with chunking
- Error correction level selection exposed to user via dropdown/radio buttons

---

## Decision 2: Character Encoding for Universal Mode

**Decision**: UTF-8 encoding with automatic percent-encoding fallback for problematic characters

**Rationale**:
- UTF-8 is standard for QR codes and supported by WeChat, Apple Camera, Alipay
- Percent-encoding (`encodeURIComponent`) handles edge cases automatically
- Non-blocking warning alerts user when encoding applied
- Maintains maximum compatibility with third-party scanners

**Alternatives Considered**:
- **ISO-8859-1 (Latin-1)**: Limited character set, would fail for Chinese/emoji
- **Block generation**: Too restrictive, forces manual editing
- **Automatic private mode switch**: Violates user autonomy principle

**Implementation Notes**:
```javascript
function encodeForUniversalQR(text) {
  try {
    // Try direct UTF-8 encoding
    return text;
  } catch (e) {
    // Fall back to percent-encoding
    showWarning("部分特殊字符已编码,可能在某些扫描器显示略有差异");
    return encodeURIComponent(text);
  }
}
```

---

## Decision 3: File Upload API

**Decision**: FileReader API with drag-and-drop support

**Rationale**:
- FileReader API available in all target browsers (Chrome 50+, Firefox 52+, Safari 11+, Edge 79+)
- `.readAsDataURL()` provides Base64 encoding directly
- Drag-and-drop enhances UX without requiring additional libraries
- Fully synchronous/offline operation

**Alternatives Considered**:
- **File System Access API**: Too new (Chrome 86+), not supported in Firefox/Safari
- **Manual Base64 encoding**: FileReader already provides this functionality
- **Input file only**: Drag-and-drop significantly improves UX with minimal code

**Implementation Notes**:
```javascript
// File input handler
document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFileUpload(file);
});

// Drag-and-drop handlers
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  handleFileUpload(file);
});

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result; // data:image/png;base64,iVBOR...
    processFile(file.name, file.type, file.size, base64);
  };
  reader.readAsDataURL(file);
}
```

---

## Decision 4: File Size Estimation Algorithm

**Decision**: Calculate QR count based on Base64 size + metadata overhead, display estimated scan time

**Rationale**:
- Base64 encoding increases size by ~33%
- Each QR code (Version 40, L-level) holds ~2953 bytes
- JSON metadata overhead: ~150 bytes per fragment
- User needs time estimation to make informed decisions

**Formula**:
```
base64Size = fileSize * 1.37 (Base64 overhead + metadata)
fragmentCapacity = 2800 bytes (conservative, accounts for JSON wrapper)
qrCount = Math.ceil(base64Size / fragmentCapacity)
estimatedScanTime = qrCount * 2 seconds (default playback speed)
```

**Alternatives Considered**:
- **Fixed capacity**: Doesn't account for metadata overhead
- **Dynamic capacity by error level**: Too complex for estimation
- **Only show QR count**: Users need time context to decide

**Implementation Notes**:
```javascript
function estimateQRCount(file) {
  const base64Size = Math.ceil(file.size * 1.37);
  const fragmentCapacity = 2800;
  const qrCount = Math.ceil(base64Size / fragmentCapacity);
  const scanTime = Math.ceil(qrCount * 2 / 60); // minutes

  return {
    qrCount,
    scanTime,
    sizeDisplay: formatBytes(file.size)
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
```

---

## Decision 5: LocalStorage Session Recovery Structure

**Decision**: JSON-based session storage with TTL timestamp and fragment tracking

**Rationale**:
- LocalStorage available in all target browsers
- JSON format matches existing private protocol
- TTL (24 hours) prevents stale session accumulation
- Fragment tracking allows out-of-order scanning

**Schema**:
```javascript
{
  "sessionId": "uuid-v4",
  "type": "text" | "file",
  "timestamp": 1696320000000,  // Unix timestamp
  "ttl": 86400000,              // 24 hours in ms
  "metadata": {
    "fileName": "document.pdf",  // file only
    "mimeType": "application/pdf", // file only
    "totalFragments": 10
  },
  "fragments": {
    "0": "base64data...",
    "2": "base64data...",
    "5": "base64data..."
  },
  "receivedCount": 3,
  "status": "in_progress" | "completed"
}
```

**Alternatives Considered**:
- **SessionStorage**: Cleared on tab close, doesn't persist across browser restarts
- **IndexedDB**: Overkill for simple key-value storage, adds complexity
- **Cookies**: Size limitations (4KB), not suitable for fragment data

**Implementation Notes**:
```javascript
// Save session
function saveSession(session) {
  session.timestamp = Date.now();
  localStorage.setItem('qr_transfer_session', JSON.stringify(session));
}

// Load session with TTL check
function loadSession() {
  const data = localStorage.getItem('qr_transfer_session');
  if (!data) return null;

  const session = JSON.parse(data);
  const age = Date.now() - session.timestamp;

  if (age > session.ttl) {
    localStorage.removeItem('qr_transfer_session');
    return null;
  }

  return session;
}

// Clear session
function clearSession() {
  localStorage.removeItem('qr_transfer_session');
}
```

---

## Decision 6: File Download API (iOS Safari Compatible)

**Decision**: Blob + URL.createObjectURL() + programmatic `<a>` click with iOS-specific handling

**Rationale**:
- Blob API universally supported
- iOS Safari requires user gesture context for downloads
- Programmatic `<a>` click works across all browsers
- Preserves original filename and MIME type

**Alternatives Considered**:
- **FileSaver.js**: External library violates zero-dependency principle
- **Data URL download**: Fails for large files (URL length limits)
- **window.open**: Blocked by popup blockers

**Implementation Notes**:
```javascript
function downloadFile(fileName, mimeType, base64Data) {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');

  // Convert base64 to binary
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  // Create Blob
  const blob = new Blob([array], { type: mimeType });

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';

  // iOS Safari needs element in DOM
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
```

---

## Decision 7: Private Protocol Enhancement (Backward Compatible)

**Decision**: Extend existing JSON protocol to support file type with metadata field

**Existing Protocol (Text)**:
```javascript
{
  "type": "text",
  "index": 0,
  "total": 5,
  "data": "base64_encoded_text_fragment"
}
```

**Enhanced Protocol (File)**:
```javascript
{
  "type": "file",
  "index": 0,
  "total": 10,
  "data": "base64_encoded_file_fragment",
  "metadata": {
    "fileName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSize": 512000,
    "checksum": "sha256_hash"  // for fragment 0 only
  }
}
```

**Rationale**:
- Maintains backward compatibility with existing text-only protocol
- `type` field distinguishes text vs file
- `metadata` only included in first fragment (index 0) to minimize overhead
- `checksum` allows integrity verification

**Alternatives Considered**:
- **Separate protocol**: Would require separate scanning modes, adds UI complexity
- **All fragments carry metadata**: Unnecessary overhead
- **No checksum**: Risk of corrupted file downloads

---

## Summary of Research Outputs

| Decision | Component | Impact |
|----------|-----------|--------|
| QR Library | Existing qrcode.js | No new dependencies, extend usage |
| Encoding | UTF-8 + percent-encoding | Compatible with WeChat/Apple Camera |
| File API | FileReader + Drag-drop | Modern browser support, good UX |
| Estimation | Base64 overhead formula | Informed user decisions |
| Storage | LocalStorage + TTL | Persistent session recovery |
| Download | Blob + iOS handling | Cross-browser file downloads |
| Protocol | Enhanced JSON | Backward compatible extension |

**Next Phase**: Proceed to Phase 1 (Design & Contracts) to define data models and API contracts based on these technical decisions.
