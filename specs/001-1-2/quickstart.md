# Quickstart Guide: Implementing QR Enhancement Features

**Date**: 2025-10-13
**Feature**: 001-1-2
**For**: Developers implementing universal QR mode and file transfer

---

## Prerequisites

- Existing QR传输系统 with sender.html and receiver.html
- Embedded qrcode.js library in sender.html
- Embedded jsQR library in receiver.html
- Basic understanding of FileReader API, LocalStorage API, Blob API

---

## Architecture Overview

This feature adds two main enhancements while maintaining the offline-first, 3-file architecture:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  index.html  │────▶│ sender.html  │     │receiver.html │
│  (Homepage)  │     │              │     │              │
└──────────────┘     │ +Mode Select │◀───▶│ +Session     │
                     │ +File Upload │     │  Recovery    │
                     │ +Estimation  │     │ +File        │
                     └──────────────┘     │  Download    │
                                          └──────────────┘
```

**Key Principle**: All code embedded inline in HTML. No external .js/.css files.

---

## Implementation Phases

### Phase 1: sender.html - Mode Selection UI

**Goal**: Add UI for users to choose between Universal and Private modes

**Location**: Insert after existing text input area

**HTML**:
```html
<!-- Mode Selection (add after text input) -->
<div class="mode-selection">
  <label>
    <input type="radio" name="qr-mode" value="universal" checked>
    <span>通用模式</span>
    <small>(兼容微信/苹果相机)</small>
  </label>
  <label>
    <input type="radio" name="qr-mode" value="private">
    <span>私有模式</span>
    <small>(支持长文本/文件)</small>
  </label>
</div>

<!-- Error Level Selection (show only for Universal mode) -->
<div class="error-level-selection" id="error-level-container" style="display:none;">
  <label for="error-level">纠错级别:</label>
  <select id="error-level">
    <option value="L">L (7% 纠错)</option>
    <option value="M" selected>M (15% 纠错)</option>
    <option value="Q">Q (25% 纠错)</option>
    <option value="H">H (30% 纠错)</option>
  </select>
  <span id="capacity-hint">最大约300字符</span>
</div>
```

**CSS** (embed in `<style>` tag):
```css
.mode-selection {
  display: flex;
  gap: 20px;
  margin: 15px 0;
}

.mode-selection label {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 8px;
}

.mode-selection input[type="radio"]:checked + span {
  font-weight: bold;
  color: #007bff;
}

.mode-selection small {
  display: block;
  color: #666;
  font-size: 12px;
}
```

**JavaScript** (embed in `<script>` tag):
```javascript
// Mode selection handler
document.querySelectorAll('input[name="qr-mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const mode = e.target.value;
    handleModeChange(mode);
  });
});

function handleModeChange(mode) {
  const errorLevelContainer = document.getElementById('error-level-container');
  const loopingControls = document.getElementById('looping-controls'); // Existing element

  if (mode === 'universal') {
    errorLevelContainer.style.display = 'block';
    loopingControls.style.display = 'none';
    updateCapacityHint();
  } else {
    errorLevelContainer.style.display = 'none';
    loopingControls.style.display = 'block';
  }
}

function updateCapacityHint() {
  const errorLevel = document.getElementById('error-level').value;
  const capacities = { L: 2953, M: 2331, Q: 1663, H: 1273 };
  const charEstimate = Math.floor(capacities[errorLevel] / 3); // Rough estimate for Chinese
  document.getElementById('capacity-hint').textContent = `最大约${charEstimate}字符`;
}

// Error level change handler
document.getElementById('error-level').addEventListener('change', updateCapacityHint);
```

---

### Phase 2: sender.html - Universal QR Generation

**Goal**: Generate standard QR codes without JSON wrapper

**JavaScript** (modify existing `generateQR()` function):
```javascript
function generateQR() {
  const text = document.getElementById('text-input').value;
  const mode = document.querySelector('input[name="qr-mode"]:checked').value;

  if (mode === 'universal') {
    generateUniversalQR(text);
  } else {
    generatePrivateQR(text); // Existing function
  }
}

function generateUniversalQR(text) {
  // Validate length
  const encoder = new TextEncoder();
  const byteLength = encoder.encode(text).length;
  const errorLevel = document.getElementById('error-level').value;
  const maxCapacity = { L: 2953, M: 2331, Q: 1663, H: 1273 }[errorLevel];

  if (byteLength > maxCapacity) {
    alert('文本过长,建议使用私有模式');
    return;
  }

  // Check for problematic characters
  let encodedText = text;
  let needsWarning = false;

  // Simple heuristic: if contains <, >, &, check if encoding needed
  if (/<|>|&/.test(text)) {
    encodedText = encodeURIComponent(text);
    needsWarning = true;
  }

  // Generate single QR code
  const qrContainer = document.getElementById('qr-container');
  qrContainer.innerHTML = ''; // Clear existing

  QRCode.toCanvas(encodedText, {
    errorCorrectionLevel: errorLevel,
    width: 400,
    margin: 2
  }, (err, canvas) => {
    if (err) {
      alert('生成二维码失败: ' + err.message);
      return;
    }

    qrContainer.appendChild(canvas);

    if (needsWarning) {
      showWarning('部分特殊字符已编码,可能在某些扫描器显示略有差异');
    }
  });
}

function showWarning(message) {
  const warning = document.createElement('div');
  warning.className = 'warning-message';
  warning.textContent = message;
  document.getElementById('qr-container').insertBefore(warning, document.getElementById('qr-container').firstChild);
}
```

---

### Phase 3: sender.html - File Upload UI

**Goal**: Add file upload with drag-and-drop support

**HTML** (add after mode selection):
```html
<!-- File Upload Area (show only for Private mode) -->
<div class="file-upload-area" id="file-upload-area" style="display:none;">
  <div class="drop-zone" id="drop-zone">
    <p>拖拽文件到这里或点击选择文件</p>
    <input type="file" id="file-input" accept="*/*" style="display:none;">
    <button type="button" onclick="document.getElementById('file-input').click()">选择文件</button>
  </div>

  <div class="file-info" id="file-info" style="display:none;">
    <h3>文件信息</h3>
    <p>文件名: <span id="file-name"></span></p>
    <p>大小: <span id="file-size"></span></p>
    <p>类型: <span id="file-type"></span></p>
    <p class="estimate" id="qr-estimate"></p>
    <button type="button" onclick="generateFileQR()">生成二维码</button>
  </div>
</div>
```

**CSS**:
```css
.drop-zone {
  border: 2px dashed #007bff;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: background 0.3s;
}

.drop-zone:hover, .drop-zone.drag-over {
  background: #f0f8ff;
}

.file-info {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
}

.estimate {
  font-weight: bold;
  color: #ff6600;
}
```

**JavaScript**:
```javascript
// Show/hide file upload based on mode
function handleModeChange(mode) {
  // ... existing code ...
  const fileUploadArea = document.getElementById('file-upload-area');
  fileUploadArea.style.display = mode === 'private' ? 'block' : 'none';
}

// Drag-and-drop handlers
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  handleFileUpload(file);
});

// File input handler
document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  handleFileUpload(file);
});

// File upload processor
function handleFileUpload(file) {
  if (!file) return;

  // Show file info
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatBytes(file.size);
  document.getElementById('file-type').textContent = file.type || '未知';

  // Estimate QR count
  const estimate = estimateQRCount(file);
  document.getElementById('qr-estimate').textContent =
    `预计生成 ${estimate.qrCount} 个二维码，扫描需约 ${estimate.scanTime} 分钟`;

  if (estimate.qrCount > 100) {
    document.getElementById('qr-estimate').innerHTML +=
      '<br><small style="color:red;">建议压缩文件以减少二维码数量</small>';
  }

  // Check for executable files
  if (/\.(exe|sh|bat|app)$/i.test(file.name)) {
    alert('检测到可执行文件类型,请确认文件来源安全');
  }

  // Store file for QR generation
  window.currentFile = file;
  document.getElementById('file-info').style.display = 'block';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function estimateQRCount(file) {
  const base64Size = Math.ceil(file.size * 1.37);
  const fragmentCapacity = 2800;
  const qrCount = Math.ceil(base64Size / fragmentCapacity);
  const scanTime = Math.ceil(qrCount * 2 / 60);

  return { qrCount, scanTime };
}
```

---

### Phase 4: sender.html - File QR Generation

**Goal**: Convert file to Base64, chunk, and generate QR codes

**JavaScript**:
```javascript
function generateFileQR() {
  const file = window.currentFile;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result; // data:mime;base64,xxx
    const base64 = base64Data.split(',')[1]; // Extract base64 part

    // Calculate checksum (simple implementation)
    const checksum = calculateSimpleChecksum(base64);

    // Chunk file
    const fragments = chunkFile(file, base64, checksum);

    // Generate QR codes (similar to existing private mode)
    generatePrivateQRCodes(fragments);
  };

  reader.readAsDataURL(file);
}

function chunkFile(file, base64, checksum) {
  const fragmentSize = 2800;
  const fragments = [];

  for (let i = 0; i < base64.length; i += fragmentSize) {
    const chunk = base64.substr(i, fragmentSize);
    const fragment = {
      type: "file",
      index: fragments.length,
      total: 0,
      data: chunk
    };

    // Add metadata to first fragment
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

function calculateSimpleChecksum(data) {
  // Simple hash for demo (use proper SHA-256 in production)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
```

---

### Phase 5: receiver.html - Session Recovery

**Goal**: Auto-recover sessions from LocalStorage on page load

**JavaScript** (add at page load):
```javascript
// Check for existing session on page load
window.addEventListener('DOMContentLoaded', () => {
  checkSessionRecovery();
});

function checkSessionRecovery() {
  const session = loadSession();

  if (!session) {
    // No session
    return;
  }

  // Check TTL
  const age = Date.now() - session.timestamp;
  if (age > session.ttl) {
    // Expired, clear
    clearSession();
    return;
  }

  // Valid session found
  showRecoveryBanner(session);

  // Restore session to memory
  window.currentSession = session;
}

function loadSession() {
  const data = localStorage.getItem('qr_transfer_session');
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (e) {
    localStorage.removeItem('qr_transfer_session');
    return null;
  }
}

function showRecoveryBanner(session) {
  const banner = document.createElement('div');
  banner.className = 'recovery-banner';
  banner.innerHTML = `
    <p>${getRecoveryMessage(session)}</p>
    <button onclick="clearAndRestart()">重新开始</button>
  `;

  document.body.insertBefore(banner, document.body.firstChild);
}

function getRecoveryMessage(session) {
  if (session.type === 'file') {
    return `已恢复文件传输: ${session.metadata.fileName} 已接收${session.receivedCount}/${session.metadata.totalFragments}片`;
  } else {
    return `已恢复传输会话: 已接收${session.receivedCount}/${session.metadata.totalFragments}片`;
  }
}

function clearAndRestart() {
  clearSession();
  location.reload();
}

function clearSession() {
  localStorage.removeItem('qr_transfer_session');
  window.currentSession = null;
}
```

**CSS** (recovery banner styling):
```css
.recovery-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff3cd;
  border-bottom: 2px solid #ffc107;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
}

.recovery-banner button {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

---

### Phase 6: receiver.html - File Download

**Goal**: Reassemble file fragments and trigger download

**JavaScript** (modify fragment reception handler):
```javascript
function handleScannedQR(qrData) {
  try {
    const fragment = JSON.parse(qrData);

    if (fragment.type === 'file') {
      handleFileFragment(fragment);
    } else {
      handleTextFragment(fragment); // Existing function
    }
  } catch (e) {
    // Not JSON, might be universal mode or invalid
    return;
  }
}

function handleFileFragment(fragment) {
  // Initialize or load session
  let session = window.currentSession || loadSession();

  if (!session) {
    // New session
    session = {
      sessionId: generateUUID(),
      type: 'file',
      timestamp: Date.now(),
      ttl: 86400000,
      metadata: fragment.metadata || {},
      fragments: {},
      receivedCount: 0,
      status: 'in_progress'
    };
  }

  // Add fragment
  if (!session.fragments[fragment.index]) {
    session.fragments[fragment.index] = fragment.data;
    session.receivedCount++;
  }

  // Save to localStorage
  saveSession(session);
  window.currentSession = session;

  // Update progress UI
  updateProgressUI(session);

  // Check if complete
  if (session.receivedCount === session.metadata.totalFragments) {
    completeFileTransfer(session);
  }
}

function completeFileTransfer(session) {
  // Reassemble
  const completeBase64 = reassembleFragments(session);

  // Verify checksum
  const calculatedChecksum = calculateSimpleChecksum(completeBase64);
  if (calculatedChecksum !== session.metadata.checksum) {
    alert('文件完整性校验失败，请重新扫描');
    clearSession();
    return;
  }

  // Trigger download
  downloadFile(session.metadata.fileName, session.metadata.mimeType, completeBase64);

  // Clean up
  clearSession();
  alert('文件下载完成!');
}

function reassembleFragments(session) {
  const indices = Object.keys(session.fragments).map(Number).sort((a, b) => a - b);
  return indices.map(i => session.fragments[i]).join('');
}

function downloadFile(fileName, mimeType, base64Data) {
  // Convert base64 to binary
  const binary = atob(base64Data);
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

function saveSession(session) {
  session.timestamp = Date.now();
  localStorage.setItem('qr_transfer_session', JSON.stringify(session));
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

---

## Testing Checklist

### Manual Testing (Constitution Requirement)

**Universal Mode**:
- [ ] Generate QR with plain text, scan with WeChat
- [ ] Generate QR with Chinese characters, scan with Apple Camera
- [ ] Try text exceeding capacity, verify error message
- [ ] Test special characters (< > &), verify encoding warning

**Private Mode - Text**:
- [ ] Generate multi-fragment text QR, scan all fragments
- [ ] Scan fragments out of order, verify correct reassembly
- [ ] Close receiver mid-scan, reopen, verify session recovery
- [ ] Click "重新开始", verify session cleared

**Private Mode - File**:
- [ ] Upload 10KB image, verify QR count estimation
- [ ] Upload 100KB PDF, verify large file warning
- [ ] Scan all file fragments, verify download triggers
- [ ] Verify downloaded file opens correctly
- [ ] Test on iOS Safari, verify file download works

**Cross-Browser**:
- [ ] Chrome - all features
- [ ] Firefox - all features
- [ ] Safari (macOS) - all features
- [ ] Safari (iOS) - camera/file download

---

## Troubleshooting

**Issue**: iOS Safari file download fails
**Solution**: Ensure `<a>` element is appended to DOM before `.click()`

**Issue**: Large files generate too many QR codes
**Solution**: Add warning at >100 QRs, suggest compression

**Issue**: Session recovery banner doesn't show
**Solution**: Check LocalStorage permissions, verify TTL hasn't expired

**Issue**: WeChat can't scan universal mode QR
**Solution**: Verify no JSON wrapper, use plain text encoding

---

## Next Steps

After implementing these features:
1. Update README.md with new feature documentation
2. Test on all target browsers
3. Update version in README.md to 2.3.0 (MINOR bump)
4. Commit changes with message: `feat: add universal QR mode and file transfer`

**Estimated Implementation Time**: 6-8 hours for all phases
