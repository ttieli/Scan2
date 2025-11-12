# Tasks: QR传输工具增强 - 通用二维码与文件传输

**Input**: Design documents from `/specs/001-1-2/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual browser testing only (per constitution - no automated test frameworks)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Project uses 3 HTML files: `index.html`, `sender.html`, `receiver.html` (all at repo root)
- All JavaScript embedded inline in `<script>` tags within HTML
- All CSS embedded inline in `<style>` tags within HTML
- NO separate .js or .css files per constitution

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Review existing sender.html and receiver.html to understand current QR generation and scanning implementation
- [X] T002 [P] Locate embedded qrcode.js library in sender.html for universal QR generation
- [X] T003 [P] Locate embedded jsQR library in receiver.html for QR scanning

**Checkpoint**: Existing code understood, ready to add enhancements

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Add mode selection utility functions to sender.html (inline JavaScript after existing code): `getSelectedMode()`, `isModeUniversal()`, `isModePrivate()` for checking selected QR generation mode
- [X] T005 Add text encoding utility functions to sender.html: `encodeForUniversalQR(text)` with percent-encoding fallback, `validateTextLength(text, errorLevel)` for capacity checking
- [X] T006 Add warning/error display utility functions to sender.html: `showWarning(message)`, `showError(message)`, `clearMessages()` for non-blocking alerts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 通用二维码生成(Universal QR Code Generation) (Priority: P1) 🎯 MVP

**Goal**: Allow users to generate standard QR codes compatible with third-party scanners (WeChat, Apple Camera)

**Independent Test**: Open sender.html, select "通用模式", input text, generate QR, scan with WeChat - verify text displays correctly

### Implementation for User Story 1

- [X] T007 [P] [US1] Add mode selection UI to sender.html (HTML): Create radio buttons for "通用模式" and "私有模式" with labels and descriptions, insert after existing text input area
- [X] T008 [P] [US1] Add error correction level selector UI to sender.html (HTML): Create dropdown with L/M/Q/H options and capacity hint span, initially hidden, show only for universal mode
- [X] T009 [P] [US1] Add CSS styling for mode selection to sender.html (inline `<style>` tag): `.mode-selection`, `.error-level-selection` with borders, spacing, radio button highlighting
- [X] T010 [US1] Implement mode selection change handler in sender.html (inline JavaScript): Listen to radio change events, show/hide error level dropdown, show/hide looping controls based on mode
- [X] T011 [US1] Implement error level change handler in sender.html: Update capacity hint text when error level changes (L:~2953, M:~2331, Q:~1663, H:~1273 bytes)
- [X] T012 [US1] Implement universal QR generation function in sender.html: `generateUniversalQR(text)` - validate length, check special characters, apply percent-encoding if needed, call QRCode.toCanvas with plain text (no JSON wrapper)
- [X] T013 [US1] Modify existing `generateQR()` function in sender.html: Check selected mode, call `generateUniversalQR(text)` if universal, call existing `generatePrivateQR(text)` if private
- [X] T014 [US1] Add validation for universal mode text length in sender.html: Show error "文本过长,建议使用私有模式" if exceeds capacity, disable generate button
- [X] T015 [US1] Add special character detection and warning in sender.html: Detect `<`, `>`, `&` characters, apply `encodeURIComponent`, show warning "部分特殊字符已编码,可能在某些扫描器显示略有差异"
- [X] T016 [US1] Update index.html: Add description of universal mode feature to homepage with link to sender.html

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can generate universal QR codes and scan them with third-party tools.

**Manual Testing (US1)**:
- Open sender.html in Chrome
- Select "通用模式"
- Input "Hello 世界!" and generate
- Scan with WeChat - verify text shows correctly
- Input text > capacity - verify error message
- Input "Test<tag>" - verify encoding warning

---

## Phase 4: User Story 2 - 私有协议文本传输(Private Protocol Text Transfer) (Priority: P2)

**Goal**: Enhance existing private mode UI clarity and add session recovery for text transfers

**Independent Test**: Open sender.html, select "私有模式", input 500-character text, generate looping QR codes, scan with receiver.html - verify complete text restoration and session recovery after page reload

### Implementation for User Story 2

- [X] T017 [P] [US2] Update private mode UI visibility logic in sender.html: Show looping controls when private mode selected (already exists, ensure visibility toggle works)
- [X] T018 [P] [US2] Add session management utility functions to receiver.html (inline JavaScript): `createSession(fragment)`, `addFragment(session, fragment)`, `isSessionComplete(session)`, `isSessionExpired(session)`, `reassembleData(session)`
- [X] T019 [P] [US2] Add LocalStorage utility functions to receiver.html: `saveSession(session)`, `loadSession()`, `clearSession()` with TTL check (24 hours = 86400000ms)
- [X] T020 [P] [US2] Add UUID generation function to receiver.html: `generateUUID()` for creating unique session IDs
- [X] T021 [US2] Add session recovery banner HTML to receiver.html: Create fixed-position div with recovery message and "重新开始" button, initially hidden, insert at top of body
- [X] T022 [US2] Add CSS styling for recovery banner to receiver.html (inline `<style>` tag): `.recovery-banner` with yellow background, top positioning, flexbox layout
- [X] T023 [US2] Implement session recovery check in receiver.html: Add `checkSessionRecovery()` function called on DOMContentLoaded, load session from LocalStorage, check TTL, show banner if valid
- [X] T024 [US2] Implement `showRecoveryBanner(session)` function in receiver.html: Display message "已恢复传输会话: 已接收X/Y片", attach clear button handler
- [X] T025 [US2] Implement `clearAndRestart()` function in receiver.html: Clear LocalStorage, reload page
- [X] T026 [US2] Modify existing text fragment handler in receiver.html: After receiving each fragment, save session to LocalStorage, update receivedCount, check if complete
- [X] T027 [US2] Add completion handler for text transfers in receiver.html: When all fragments received, reassemble text, display result, play success sound (if exists), clear session

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Private mode text transfers support session recovery.

**Manual Testing (US2)**:
- Open sender.html, select "私有模式"
- Input 500-character long text
- Generate and verify looping QR codes
- Open receiver.html, scan all QR codes
- Close receiver.html mid-scan
- Reopen receiver.html - verify recovery banner shows
- Continue scanning - verify completion

---

## Phase 5: User Story 3 - 文件传输与还原(File Transfer and Restoration) (Priority: P3)

**Goal**: Enable file upload, chunking, transmission, and restoration with session recovery

**Independent Test**: Open sender.html, upload 10KB test.jpg, generate QR codes, scan with receiver.html, download file - verify file opens correctly with same name and content

### Implementation for User Story 3

- [X] T028 [P] [US3] Add file upload area HTML to sender.html: Create drop zone div with drag-drop instructions, hidden file input, "选择文件" button, initially hidden
- [X] T029 [P] [US3] Add file info display HTML to sender.html: Create div with file name, size, type, QR count estimation display, "生成二维码" button, initially hidden
- [X] T030 [P] [US3] Add CSS styling for file upload area to sender.html (inline `<style>` tag): `.drop-zone` with dashed border, `.file-info` with background color, `.estimate` with bold warning styling
- [X] T031 [US3] Update mode selection handler in sender.html: Show file upload area when private mode selected, hide when universal mode selected
- [X] T032 [US3] Implement drag-and-drop event handlers in sender.html: Add `dragover`, `dragleave`, `drop` listeners to drop zone, prevent default, add/remove `drag-over` class
- [X] T033 [US3] Implement file input change handler in sender.html: Listen to file input change event, call `handleFileUpload(file)`
- [X] T034 [US3] Implement `handleFileUpload(file)` function in sender.html: Display file info (name, size, type), call `estimateQRCount(file)`, show estimation with warning if >100 QR codes, check for executable files and show security warning
- [X] T035 [US3] Implement `estimateQRCount(file)` function in sender.html: Calculate `base64Size = fileSize * 1.37`, `qrCount = ceil(base64Size / 2800)`, `scanTime = ceil(qrCount * 2 / 60)`, return estimates
- [X] T036 [US3] Implement `formatBytes(bytes)` utility function in sender.html: Convert bytes to "B", "KB", or "MB" format
- [X] T037 [US3] Implement `generateFileQR()` function in sender.html: Use FileReader.readAsDataURL, wait for onload, extract base64 data, calculate checksum, call `chunkFile(file, base64, checksum)`, generate QR codes
- [X] T038 [US3] Implement `chunkFile(file, base64, checksum)` function in sender.html: Split base64 into 2800-byte chunks, create JSON fragments with type="file", add metadata (fileName, mimeType, fileSize, checksum) to index 0 only
- [X] T039 [US3] Implement `calculateSimpleChecksum(data)` function in sender.html: Simple hash algorithm for integrity verification (or use existing if available)
- [X] T040 [US3] Reuse existing `generatePrivateQRCodes(fragments)` function in sender.html: Verify it supports file fragments (type="file") and displays them in looping mode
- [X] T041 [P] [US3] Implement `handleFileFragment(fragment)` function in receiver.html: Load/create session, extract metadata from index 0, add fragment data to session, save to LocalStorage, update UI progress, check if complete
- [X] T042 [P] [US3] Implement file progress UI update in receiver.html: Show "已接收X/Y片，已接收XXX/YYY KB" for file transfers
- [X] T043 [US3] Modify existing QR scan handler in receiver.html: Parse JSON, check fragment.type, call `handleFileFragment(fragment)` if type="file", call existing `handleTextFragment(fragment)` if type="text"
- [X] T044 [US3] Implement `completeFileTransfer(session)` function in receiver.html: Reassemble fragments, verify checksum, call `downloadFile(fileName, mimeType, base64Data)`, clear session, show success alert
- [X] T045 [US3] Implement checksum verification in receiver.html: Calculate checksum of reassembled data, compare with session.metadata.checksum, show error "文件完整性校验失败，请重新扫描" if mismatch
- [X] T046 [US3] Implement `downloadFile(fileName, mimeType, base64Data)` function in receiver.html: Convert base64 to binary using `atob()`, create Uint8Array, create Blob, use URL.createObjectURL(), create anchor element, trigger click, append/remove from DOM for iOS Safari compatibility
- [X] T047 [US3] Update recovery banner in receiver.html: Show file-specific message "已恢复文件传输: [文件名] 已接收X/Y片" for file transfer sessions
- [X] T048 [US3] Update README.md: Document file transfer feature, add usage instructions, note file size recommendations, list supported file types

**Checkpoint**: All user stories should now be independently functional. File transfer works end-to-end with session recovery.

**Manual Testing (US3)**:
- Open sender.html
- Drag-drop a 10KB test.jpg file
- Verify QR count estimation shows
- Generate QR codes
- Open receiver.html, scan all fragments
- Verify download triggers automatically
- Open downloaded file - verify it's identical
- Test on iOS Safari - verify download works
- Test session recovery by closing mid-transfer

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T049 [P] Update index.html: Add comprehensive feature descriptions for universal mode, private mode enhancements, and file transfer with clear navigation links
- [X] T050 [P] Update README.md: Add version bump to 2.3.0, document all new features, add screenshots/examples, update usage instructions, add manual testing guide
- [X] T051 [P] Add console logging for debugging in sender.html and receiver.html: Log mode changes, QR generation events, file uploads, fragment reception events (can be removed/commented out for production)
- [X] T052 Code cleanup in sender.html: Add HTML comments to separate sections (`<!-- Mode Selection UI -->`, `<!-- File Upload Logic -->`, etc.), ensure proper indentation
- [X] T053 Code cleanup in receiver.html: Add HTML comments for sections (`<!-- Session Recovery -->`, `<!-- File Download Logic -->`, etc.), ensure consistent formatting
- [ ] T054 Cross-browser compatibility check: Test all features in Chrome, Firefox, Safari (macOS), Edge - document any browser-specific issues
- [ ] T055 iOS Safari compatibility check: Test camera scanning, file uploads, and file downloads on iOS Safari - implement workarounds if needed
- [ ] T056 Performance optimization: Verify QR generation <1s for text, <3s for files <100KB - optimize if needed
- [ ] T057 Accessibility check: Ensure all form controls have proper labels, buttons have clear text, error messages are screen-reader friendly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion - can run in parallel with US1 if separate developers
- **User Story 3 (Phase 5)**: Depends on Foundational phase completion AND partially on US2 (session recovery utilities) - some tasks can parallel US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - **This is the MVP**
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Mostly independent, adds to existing private mode
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Reuses session utilities from US2 (T018-T020) but can be developed in parallel

### Within Each User Story

**User Story 1 (Universal QR)**:
- T007-T009 (HTML/CSS) can run in parallel
- T010-T011 (event handlers) depend on T007-T009
- T012-T015 (generation logic) can start after T010
- T016 (index.html) can run anytime in parallel

**User Story 2 (Session Recovery)**:
- T017-T020 (utilities) can run in parallel
- T021-T022 (UI) can run in parallel
- T023-T025 (recovery logic) depend on T018-T022
- T026-T027 (integration) depend on T023-T025

**User Story 3 (File Transfer)**:
- T028-T030 (HTML/CSS) can run in parallel
- T031-T033 (drag-drop) depend on T028
- T034-T039 (sender logic) can progress sequentially
- T041-T042 (receiver UI) can run in parallel with sender tasks
- T043-T047 (receiver logic) depend on T041-T042 and T018-T020 from US2
- T048 (docs) can run anytime

### Parallel Opportunities

- **Within Setup**: T002 and T003 can run in parallel (different review tasks)
- **Within US1**: T007, T008, T009 can run in parallel (HTML and CSS in same file but different sections)
- **Within US2**: T017-T020 can run in parallel (different utility functions)
- **Within US2**: T021 and T022 can run in parallel (HTML and CSS)
- **Within US3**: T028, T029, T030 can run in parallel (HTML and CSS)
- **Within US3**: T041 and T042 can run in parallel (different receiver functions)
- **Across Stories**: If team has multiple developers:
  - After Phase 2: US1 and US2 can be developed completely in parallel
  - After Phase 2: US3 sender tasks (T028-T040) can parallel US2
- **Within Polish**: T049, T050, T051 can all run in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch UI tasks together:
Task T007: Add mode selection UI HTML
Task T008: Add error level selector HTML
Task T009: Add CSS styling for mode selection

# Then launch event handlers together:
Task T010: Implement mode selection change handler
Task T011: Implement error level change handler

# Then launch generation logic tasks:
Task T012: Implement generateUniversalQR function
Task T013: Modify existing generateQR function
Task T014: Add text length validation
Task T015: Add special character detection
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006) - **CRITICAL GATE**
3. Complete Phase 3: User Story 1 (T007-T016)
4. **STOP and VALIDATE**: Test universal QR mode with WeChat, Apple Camera, Alipay
5. If validated, deploy/demo - **You now have a working MVP!**

### Incremental Delivery

1. Complete Setup + Foundational (T001-T006) → Foundation ready
2. Add User Story 1 (T007-T016) → Test independently → **Deploy/Demo (MVP!)**
3. Add User Story 2 (T017-T027) → Test independently → Deploy/Demo (session recovery added)
4. Add User Story 3 (T028-T048) → Test independently → Deploy/Demo (file transfer added)
5. Add Polish (T049-T057) → Final production-ready release

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T006)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T007-T016) - works on sender.html universal mode
   - **Developer B**: User Story 2 (T017-T027) - works on receiver.html session recovery
   - **Developer C**: User Story 3 sender (T028-T040) - works on sender.html file upload
3. After US2 complete, Developer B continues with US3 receiver (T041-T047)
4. Stories complete and integrate independently
5. Team completes Polish together (T049-T057)

---

## Manual Testing Checklist

**Per Constitution: No automated tests. Manual browser testing is primary method.**

### Test Environment Setup
- [ ] Chrome (latest version)
- [ ] Firefox (latest version)
- [ ] Safari macOS (latest version)
- [ ] Safari iOS (physical device or simulator)
- [ ] Edge (latest version)
- [ ] WeChat app (for universal QR scanning)
- [ ] Apple Camera app (for universal QR scanning)

### User Story 1 Tests
- [ ] Select universal mode - verify error level dropdown shows
- [ ] Select private mode - verify error level dropdown hides
- [ ] Change error level L/M/Q/H - verify capacity hint updates
- [ ] Input 50 characters, generate universal QR - scan with WeChat
- [ ] Input Chinese + emoji, generate - scan with Apple Camera
- [ ] Input text with `<tag>` - verify encoding warning shows
- [ ] Input text > capacity - verify error message and button disabled
- [ ] Verify no looping controls shown for universal mode

### User Story 2 Tests
- [ ] Select private mode, input 500 characters, generate
- [ ] Verify multiple QR codes with sequence numbers (1/N, 2/N)
- [ ] Verify looping playback with speed control
- [ ] Scan all fragments with receiver.html
- [ ] Verify progress display "已接收X/Y片"
- [ ] Close receiver mid-scan, reopen
- [ ] Verify recovery banner shows with correct count
- [ ] Click "重新开始" - verify session clears
- [ ] Complete scan - verify text displays and sound plays

### User Story 3 Tests
- [ ] Select private mode - verify file upload area shows
- [ ] Drag-drop 10KB image file
- [ ] Verify file info displays correctly
- [ ] Verify QR count estimation shows
- [ ] Upload 200KB file - verify warning about >100 QR codes
- [ ] Upload .exe file - verify security warning
- [ ] Generate file QR codes, scan with receiver
- [ ] Verify file progress shows with KB counts
- [ ] Complete scan - verify automatic download triggers
- [ ] Verify downloaded file has correct name and extension
- [ ] Open downloaded file - verify content is identical
- [ ] Test on iOS Safari - verify download works
- [ ] Close receiver mid-file-scan, reopen
- [ ] Verify recovery banner shows file name
- [ ] Complete transfer - verify checksum validation

### Cross-Browser Tests
- [ ] Repeat US1 tests in all browsers
- [ ] Repeat US2 tests in Chrome, Firefox, Safari
- [ ] Repeat US3 tests in all browsers, especially iOS Safari

### Performance Tests
- [ ] Text QR generation <1s
- [ ] File QR generation <3s for files <100KB
- [ ] Scanner frame rate >15fps
- [ ] Session recovery load <500ms

### Accessibility Tests
- [ ] Tab through all form controls - verify logical order
- [ ] Screen reader test - verify all labels readable
- [ ] High contrast mode - verify UI still usable
- [ ] Keyboard only navigation - verify all functions accessible

---

## Notes

- [P] tasks = different files or different sections of same file, no dependencies
- [Story] label (US1, US2, US3) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- All code must be embedded inline per constitution (no external .js/.css files)
- Manual testing is PRIMARY validation method (no automated test frameworks)
- Commit after each completed user story phase
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- File paths: All HTML files are at repo root (sender.html, receiver.html, index.html)

---

## Summary

- **Total Tasks**: 57
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 3 tasks (BLOCKING)
- **User Story 1**: 10 tasks (MVP)
- **User Story 2**: 11 tasks
- **User Story 3**: 23 tasks
- **Polish Phase**: 9 tasks

**Estimated Total Effort**: 6-9 hours
- User Story 1: 2-3 hours
- User Story 2: 1-2 hours
- User Story 3: 3-4 hours
- Polish: 1-2 hours

**Parallel Opportunities**: 15+ tasks can run in parallel within each phase
**MVP Scope**: T001-T016 (Setup + Foundational + US1) = ~3 hours
**Independent Testing**: Each user story has clear acceptance criteria and can be validated separately
