# Implementation Plan: QR传输工具增强 - 通用二维码与文件传输

**Branch**: `001-1-2` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-1-2/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enhances the existing QR code data transfer system with two major capabilities:

1. **Universal QR Mode (P1)**: Generate standard QR codes compatible with third-party scanners (WeChat, Apple Camera, Alipay) without chunking or looping. Users can choose between "Universal Mode" (standard QR) and "Private Mode" (custom protocol with chunking/looping).

2. **File Transfer (P3)**: Support file upload, encoding to Base64, chunking via private protocol, and automatic file restoration with download on the receiver side. No hard file size limit - users see estimated QR count and decide whether to proceed.

**Technical Approach**: Enhance existing sender.html and receiver.html with mode selection UI, universal QR generation (plain text encoding), file upload handling with FileReader API, and session recovery via LocalStorage. All functionality embedded inline per constitution.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES6+), HTML5, CSS3 (no transpilation/build step)
**Primary Dependencies**: QR code libraries (embedded inline in HTML) - qrcode.js for generation, jsQR or similar for scanning. All dependencies must be embedded as minified source within `<script>` tags.
**Storage**: Browser LocalStorage API for session recovery (24-hour TTL), FileReader API for file upload, Blob API for file download
**Testing**: Manual browser testing (Chrome, Firefox, Safari including iOS, Edge). No automated test framework per constitution.
**Target Platform**: Modern web browsers (Chrome 50+, Firefox 52+, Safari 11+, Edge 79+). iOS Safari support is MANDATORY for camera/file features.
**Project Type**: Offline-first HTML application (3 files: index.html, sender.html, receiver.html)
**Performance Goals**: QR generation <1s for text, <3s for files <100KB; Scanner frame rate >15fps; Session recovery <500ms
**Constraints**: Complete offline capability (no CDN/external resources), file size targets (index <10KB, sender <50KB, receiver <300KB), no build tools/npm
**Scale/Scope**: Single-user local operation, supports files up to multiple MB (user-decided based on QR count estimation), 3 HTML files total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: Offline-First Architecture ✅ PASS
- ✅ All QR libraries will be embedded inline (no CDN)
- ✅ No network dependencies except GitHub Pages hosting
- ✅ System works by opening HTML files locally

### Gate 2: Zero External Dependencies ✅ PASS
- ✅ No npm, yarn, package.json
- ✅ No webpack, vite, or bundlers
- ✅ QR libraries embedded as minified inline `<script>` blocks

### Gate 3: Self-Contained HTML Design ✅ PASS
- ✅ All JavaScript embedded in `<script>` tags
- ✅ All CSS embedded in `<style>` tags
- ✅ No external .js or .css files

### Gate 4: Minimal File Structure ✅ PASS
- ✅ Modifying only existing 3 HTML files (index.html, sender.html, receiver.html)
- ✅ No additional files created
- ✅ README.md will be updated with new features

### Gate 5: Embedded Functionality ✅ PASS
- ✅ Mode selection logic inline in sender.html
- ✅ File upload/encoding inline in sender.html
- ✅ Session recovery inline in receiver.html
- ✅ Some utility code duplication acceptable (e.g., Base64 helpers in both files)

### Gate 6: Pragmatic Simplicity ✅ PASS
- ✅ Using vanilla JavaScript, no frameworks
- ✅ Direct DOM manipulation
- ✅ No MVC/MVVM patterns
- ✅ Straightforward imperative code for mode switching and file handling

### Gate 7: Testing & Validation ✅ PASS
- ✅ Manual testing plan in README.md
- ✅ Cross-browser testing (Chrome, Firefox, Safari, Edge)
- ✅ iOS Safari mandatory testing for camera/file features
- ✅ No automated test frameworks

**Pre-Research Gate Result**: ✅ ALL GATES PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
/Users/tieli/Library/Mobile Documents/com~apple~CloudDocs/Project/QR_Group_Scan/
├── index.html          # Homepage/navigation (MODIFY: add links to new features)
├── sender.html         # QR generation page (MODIFY: add mode selection, file upload, estimation)
├── receiver.html       # QR scanning page (MODIFY: add session recovery banner, file download)
├── README.md           # Documentation (UPDATE: document new features)
├── .git/               # Version control (existing)
└── .specify/           # Planning artifacts (NOT distributed to users)
    ├── memory/
    │   └── constitution.md
    └── templates/
```

**Structure Decision**: This is an offline-first HTML application consisting of exactly 3 HTML files per Constitution Principle IV. No src/ directories, no separate JavaScript/CSS files. All code is embedded inline within the HTML files using `<script>` and `<style>` tags. The `.specify/` directory contains planning artifacts only and is not part of the distributed application.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All gates pass. This feature enhances existing HTML files without violating any constitution principles.

---

## Planning Phase Complete ✅

**Date Completed**: 2025-10-13

### Artifacts Generated

1. **plan.md** (this file) - Implementation plan with technical context and constitution compliance
2. **research.md** - Technical decisions for QR libraries, browser APIs, encoding strategies
3. **data-model.md** - JavaScript object models for QRCodeMode, TextMessage, FileMetadata, QRFragment, TransferSession
4. **contracts/qr-protocol.md** - Protocol specifications for Universal Mode, Private Mode (Text/File), Session Recovery
5. **quickstart.md** - Developer implementation guide with code samples for all 6 implementation phases
6. **CLAUDE.md** - Agent context file updated with technology stack

### Post-Design Constitution Check ✅

Re-evaluated all gates after Phase 1 design:

- ✅ **Offline-First**: QR libraries embedded, LocalStorage for sessions, no network calls
- ✅ **Zero Dependencies**: FileReader/Blob/LocalStorage are native browser APIs
- ✅ **Self-Contained HTML**: All code in quickstart.md designed for inline embedding
- ✅ **Minimal Files**: Only modifying existing 3 HTML files (index, sender, receiver)
- ✅ **Embedded Functionality**: Mode selection, file upload, session recovery all inline
- ✅ **Simplicity**: Vanilla JavaScript, direct DOM manipulation, no frameworks
- ✅ **Testing**: Manual testing checklist provided in quickstart.md

**Final Gate Result**: ✅ ALL GATES PASS

### Next Command

```bash
/speckit.tasks
```

This will generate the task breakdown (tasks.md) based on the user stories in spec.md and the design artifacts created in this planning phase.

### Estimated Implementation Effort

- **User Story 1 (P1)**: Universal QR Mode - 2-3 hours
- **User Story 2 (P2)**: Private Mode Enhancement - 1-2 hours (mostly UI clarification)
- **User Story 3 (P3)**: File Transfer - 3-4 hours
- **Total**: 6-9 hours for full implementation + testing

### Key Implementation Notes

1. Mode selection UI drives visibility of related controls (error level, looping, file upload)
2. FileReader API handles file-to-Base64 conversion
3. Estimation formula: `qrCount = ceil((fileSize * 1.37) / 2800)`
4. Session recovery auto-loads on receiver.html page load with TTL check
5. iOS Safari requires `<a>` element in DOM for file downloads
6. Checksum verification prevents corrupted file downloads
