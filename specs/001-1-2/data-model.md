# Data Model: QR传输工具增强

**Date**: 2025-10-13
**Feature**: 001-1-2
**Context**: JavaScript objects for in-memory data management (no database)

---

## Overview

This system uses JavaScript objects for runtime state management. Data is persisted only in browser LocalStorage for session recovery. All entities are represented as plain JavaScript objects (POJOs) with no ORM or database layer.

---

## Entity 1: QRCodeMode

**Purpose**: Represents the selected QR generation mode

**Fields**:
- `type`: string - "universal" | "private"
- `displayName`: string - "通用模式" | "私有模式"
- `supportsChunking`: boolean - false for universal, true for private
- `supportsLooping`: boolean - false for universal, true for private

**Validation Rules**:
- `type` MUST be one of: "universal", "private"
- Universal mode does NOT support chunking or looping
- Private mode MUST support both chunking and looping

**State Transitions**:
```
Initial → Universal Selected → Generating QR
       ↘ Private Selected → Generating QRs (chunked)
```

**Example**:
```javascript
const universalMode = {
  type: "universal",
  displayName: "通用模式",
  supportsChunking: false,
  supportsLooping: false
};

const privateMode = {
  type: "private",
  displayName: "私有模式",
  supportsChunking: true,
  supportsLooping: true
};
```

---

## Entity 2: TextMessage

**Purpose**: Represents text content to be transmitted via QR code

**Fields**:
- `content`: string - Raw text input from user
- `encoding`: string - "utf-8" (constant)
- `length`: number - Character count
- `byteLength`: number - Byte count after UTF-8 encoding
- `needsEncoding`: boolean - Whether special characters require percent-encoding
- `encoded`: string - Percent-encoded version if needed

**Validation Rules**:
- `content` MUST NOT be empty
- For universal mode: `byteLength` MUST be ≤ 2953 bytes (Version 40, L-level)
- For private mode: No length limit (will be chunked)
- If `needsEncoding` is true, `encoded` MUST contain percent-encoded version

**Relationships**:
- ONE TextMessage → MANY QRFragments (when private mode used)

**Example**:
```javascript
const textMessage = {
  content: "Hello 世界! 🌍",
  encoding: "utf-8",
  length: 11,
  byteLength: 19,
  needsEncoding: false,
  encoded: null
};
```

---

## Entity 3: FileMetadata

**Purpose**: Represents metadata for uploaded files

**Fields**:
- `fileName`: string - Original file name with extension
- `fileExtension`: string - Extracted extension (e.g., ".pdf", ".jpg")
- `mimeType`: string - MIME type (e.g., "application/pdf")
- `fileSize`: number - Size in bytes
- `base64Data`: string - Base64-encoded file content (data URL format)
- `checksum`: string - SHA-256 hash for integrity verification

**Validation Rules**:
- `fileName` MUST NOT be empty
- `fileExtension` MUST match common file types (txt, pdf, jpg, png, gif, zip, docx, etc.)
- `mimeType` MUST be valid MIME type
- `fileSize` MUST be > 0
- `base64Data` MUST start with "data:{mimeType};base64,"
- For executable files (.exe, .sh, .bat), show security warning but allow upload

**Derived Fields**:
```javascript
estimatedQRCount = Math.ceil((fileSize * 1.37) / 2800)
estimatedScanTime = Math.ceil(estimatedQRCount * 2 / 60) // minutes
```

**Example**:
```javascript
const fileMetadata = {
  fileName: "document.pdf",
  fileExtension: ".pdf",
  mimeType: "application/pdf",
  fileSize: 102400, // 100KB
  base64Data: "data:application/pdf;base64,JVBERi0xLjQK...",
  checksum: "a3f5c8b9e1d2..."
};
```

---

## Entity 4: QRFragment

**Purpose**: Represents a single QR code fragment in private protocol

**Fields**:
- `type`: string - "text" | "file"
- `index`: number - 0-based fragment index
- `total`: number - Total fragment count
- `data`: string - Base64-encoded fragment data
- `metadata`: object | null - FileMetadata (only for index 0 when type="file")

**Validation Rules**:
- `index` MUST be >= 0 and < `total`
- `total` MUST be > 0
- `data` MUST be non-empty base64 string
- `metadata` MUST be present if `type` == "file" AND `index` == 0
- `metadata` MUST be null for all other fragments

**JSON Protocol Format**:
```javascript
// Text fragment
{
  "type": "text",
  "index": 2,
  "total": 5,
  "data": "SGVsbG8gV29ybGQ="
}

// File fragment (first fragment with metadata)
{
  "type": "file",
  "index": 0,
  "total": 10,
  "data": "JVBERi0xLjQK...",
  "metadata": {
    "fileName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSize": 102400,
    "checksum": "a3f5c8b9e1d2..."
  }
}

// File fragment (subsequent fragments)
{
  "type": "file",
  "index": 1,
  "total": 10,
  "data": "TWFueSBwYWdlcw=="
}
```

**State Lifecycle**:
```
Created → JSON Stringify → QR Encode → Display
       ↓
Scanned → QR Decode → JSON Parse → Stored in TransferSession
```

---

## Entity 5: TransferSession

**Purpose**: Manages ongoing transfer sessions with LocalStorage persistence

**Fields**:
- `sessionId`: string - UUID v4 identifier
- `type`: string - "text" | "file"
- `timestamp`: number - Unix timestamp (ms) when session started
- `ttl`: number - Time-to-live in ms (86400000 = 24 hours)
- `metadata`: object - Varies by type
  - For text: `{ totalFragments: number }`
  - For file: `{ fileName: string, mimeType: string, fileSize: number, totalFragments: number, checksum: string }`
- `fragments`: object - Map of `index` → `data` (received fragments)
- `receivedCount`: number - Count of unique fragments received
- `status`: string - "in_progress" | "completed"

**Validation Rules**:
- `sessionId` MUST be unique UUID
- `timestamp` + `ttl` determines expiry (auto-delete if expired)
- `receivedCount` MUST equal Object.keys(fragments).length
- `status` == "completed" when `receivedCount` == `metadata.totalFragments`

**State Transitions**:
```
Not Exists → Created (first fragment received)
          ↓
In Progress → Receiving fragments (receivedCount < total)
          ↓
Completed → All fragments received → Download triggered
          ↓
Cleared → User clicks "重新开始" or TTL expired
```

**LocalStorage Key**: `qr_transfer_session`

**Example**:
```javascript
const session = {
  sessionId: "550e8400-e29b-41d4-a716-446655440000",
  type: "file",
  timestamp: 1696320000000,
  ttl: 86400000,
  metadata: {
    fileName: "document.pdf",
    mimeType: "application/pdf",
    fileSize: 102400,
    totalFragments: 10,
    checksum: "a3f5c8b9e1d2..."
  },
  fragments: {
    "0": "JVBERi0xLjQK...",
    "2": "TWFueSBwYWdlcw==",
    "5": "RW5kIG9mIGZpbGU="
  },
  receivedCount: 3,
  status: "in_progress"
};
```

**Methods** (implemented as pure functions):
```javascript
// Create new session from first fragment
function createSession(fragment) { ... }

// Add fragment to session
function addFragment(session, fragment) { ... }

// Check if session complete
function isSessionComplete(session) {
  return session.receivedCount === session.metadata.totalFragments;
}

// Check if session expired
function isSessionExpired(session) {
  return (Date.now() - session.timestamp) > session.ttl;
}

// Reassemble fragments into complete data
function reassembleData(session) {
  const sortedFragments = Object.keys(session.fragments)
    .map(Number)
    .sort((a, b) => a - b)
    .map(index => session.fragments[index]);

  return sortedFragments.join('');
}
```

---

## Relationships

```
QRCodeMode
    ↓ (user selects)
TextMessage OR FileMetadata
    ↓ (chunks if private mode)
Multiple QRFragments
    ↓ (scanned by receiver)
TransferSession
    ↓ (reassembles)
Final Data (download if file)
```

**Cardinality**:
- 1 QRCodeMode → 1 TextMessage/FileMetadata
- 1 TextMessage/FileMetadata → 0..N QRFragments (0 if universal mode, N if private mode)
- 1 TransferSession → 1..N QRFragments (must have at least 1)

---

## Data Flow Diagrams

### Universal Mode (Text Only)
```
User Input → TextMessage → (no chunking) → Single QR Code → Third-party Scanner
```

### Private Mode (Text)
```
User Input → TextMessage → Chunking → Multiple QRFragments → Display Loop
                                           ↓
Receiver Scans → TransferSession → Accumulates Fragments → Reassemble → Display Text
```

### Private Mode (File)
```
File Upload → FileMetadata → Base64 Encode → Chunking → Multiple QRFragments → Display Loop
                                                              ↓
Receiver Scans → TransferSession → Accumulates Fragments → Verify Checksum → Download File
```

---

## Persistence Strategy

**In-Memory Only**:
- QRCodeMode (UI state)
- TextMessage (temporary)
- FileMetadata (temporary)
- QRFragments (generated on-the-fly, not stored)

**LocalStorage (24-hour TTL)**:
- TransferSession (key: `qr_transfer_session`)
- Automatically cleared when expired or user clicks "重新开始"

**No Server/Database**:
- All operations client-side
- No API calls
- Complete offline functionality

---

## Summary

| Entity | Purpose | Persistence | Key Validation |
|--------|---------|-------------|----------------|
| QRCodeMode | Mode selection | In-memory only | type must be "universal" or "private" |
| TextMessage | Text to transmit | In-memory only | Length check for universal mode |
| FileMetadata | File info | In-memory only | Size estimation, MIME type validation |
| QRFragment | Protocol packet | Generated on-the-fly | JSON structure, index bounds |
| TransferSession | Receiver state | LocalStorage (24h) | TTL check, fragment tracking |

**Next Phase**: Define protocol contracts in `/contracts/` directory.
