<!--
Sync Impact Report:
Version: 0.0.0 → 1.0.0
Rationale: Initial constitution creation with 7 core principles tailored to offline-first QR data transfer system

Principles Added:
- I. Offline-First Architecture (CRITICAL)
- II. Zero External Dependencies (CRITICAL)
- III. Self-Contained HTML Design (CRITICAL)
- IV. Minimal File Structure (CRITICAL)
- V. Embedded Functionality
- VI. Pragmatic Simplicity
- VII. Testing & Validation

Templates Status:
✅ plan-template.md - Reviewed, compatible (focuses on language-agnostic planning)
✅ spec-template.md - Reviewed, compatible (user stories applicable to HTML features)
✅ tasks-template.md - Reviewed, needs minor note (HTML context instead of src/ directories)

Follow-up TODOs: None - all placeholders filled
-->

# QR数据传输系统 Constitution

## Core Principles

### I. Offline-First Architecture (CRITICAL)

The entire project MUST function completely offline except for GitHub Pages deployment. This principle is NON-NEGOTIABLE.

**Rules:**
- All libraries, frameworks, and dependencies MUST be embedded locally in HTML files
- NO CDN links, external script sources, or network-dependent resources
- The system MUST work by simply opening HTML files in a browser without internet connection
- GitHub Pages deployment is the ONLY exception where network is involved (for hosting only)

**Rationale:** Users must be able to download the 3 HTML files and use them immediately in air-gapped environments, offline scenarios, or situations with unreliable network connectivity. This ensures maximum accessibility and reliability.

### II. Zero External Dependencies (CRITICAL)

NO external package managers, build tools, or dependency management systems. This principle is NON-NEGOTIABLE.

**Rules:**
- NO npm, yarn, or any package.json files
- NO webpack, vite, rollup, or bundling tools
- NO external CSS frameworks requiring installation
- All QR code libraries, JavaScript utilities, and styling MUST be embedded directly in HTML files
- If a library is needed, its minified source MUST be included inline via `<script>` or `<style>` tags

**Rationale:** Eliminates dependency hell, version conflicts, and installation barriers. Users get immediate functionality without setup overhead. Aligns with offline-first architecture by ensuring complete self-containment.

### III. Self-Contained HTML Design (CRITICAL)

Each HTML file is a complete, standalone application. This principle is NON-NEGOTIABLE.

**Rules:**
- ALL JavaScript MUST be embedded in `<script>` tags within HTML files
- ALL CSS MUST be embedded in `<style>` tags within HTML files
- NO external .js, .css, .ts, or other code files (除了 index.html 和 README.md)
- Each HTML file contains its complete functionality: logic, styling, and structure
- Code organization within HTML files via comments and logical sections is encouraged

**Rationale:** Simplifies deployment (just 3 files), eliminates file path issues, ensures portability, and makes the entire application's scope visible in each file. Users can inspect, modify, and understand the complete system by viewing the HTML source.

### IV. Minimal File Structure (CRITICAL)

The project MUST consist of exactly 3 HTML files plus supporting documentation only. This principle is NON-NEGOTIABLE.

**Rules:**
- Exactly 3 HTML files: `index.html` (navigation/homepage), `sender.html` (QR generation), `receiver.html` (QR scanning)
- Documentation files allowed: `README.md` (primary documentation)
- `.specify/` directory for project constitution and planning (NOT distributed to users)
- `.git/` directory for version control (NOT distributed to users)
- NO additional HTML files, NO JavaScript modules, NO CSS files, NO configuration files
- NO separate test files, build scripts, or utility scripts

**Rationale:** Extreme simplicity reduces cognitive load, eliminates file management complexity, and makes the project instantly understandable. Users receive exactly 3 files that do everything. Any feature that requires additional files MUST be rejected or redesigned to fit within the 3-file constraint.

### V. Embedded Functionality

All functionality MUST be implemented within the HTML file boundaries.

**Rules:**
- QR code generation logic embedded in `sender.html`
- QR code scanning logic embedded in `receiver.html`
- Base64 encoding/decoding embedded inline
- Data chunking/reassembly logic embedded inline
- UI controls, event handlers, and state management ALL inline
- No lazy loading from external sources
- Shared utilities (if any) MUST be duplicated across HTML files rather than extracted

**Rationale:** Maintains self-containment principle. Each HTML file remains independently functional. Slight code duplication is acceptable trade-off for eliminating external dependencies and preserving offline capability.

### VI. Pragmatic Simplicity (务求实效简介)

Avoid unnecessary architectural complexity, design patterns, or abstractions.

**Rules:**
- Prefer straightforward imperative code over complex abstractions
- NO MVC/MVVM frameworks or patterns unless absolutely necessary
- NO TypeScript compilation or transpilation steps
- NO component-based frameworks (React, Vue, Angular) unless embedded as single-file inline code
- Direct DOM manipulation and vanilla JavaScript are preferred
- Performance optimizations MUST be proven necessary before adding complexity
- Feature additions MUST justify their complexity against the simplicity principle

**Rationale:** Over-engineering kills maintainability in small projects. This is a 3-file system focused on data transfer via QR codes. Complex architectures would violate the project's essence and make it harder for users to understand, modify, and trust the code.

### VII. Testing & Validation

Testing MUST be practical and inline with the architecture constraints.

**Rules:**
- Manual testing via browser is the PRIMARY testing method
- Automated tests (if any) MUST NOT require external test frameworks or files
- Test procedures documented in README.md or as HTML comments
- Critical paths to test: QR generation, scanning, chunking, reassembly, encoding/decoding
- Cross-browser testing (Chrome, Firefox, Safari, Edge) MUST be performed for major changes
- iOS Safari compatibility is MANDATORY (explicitly test on iOS devices)
- Test documentation can include screenshots or GIFs in README.md

**Rationale:** Traditional testing frameworks would violate Zero Dependencies and Minimal File Structure principles. Manual testing is appropriate for small HTML applications. Focus on real-world usage scenarios rather than unit test coverage metrics.

## Architecture Constraints

### File Size Guidelines

- `index.html`: Target < 10KB (navigation page, minimal code)
- `sender.html`: Target < 50KB (QR generation library + logic)
- `receiver.html`: Target < 300KB (QR scanning library + camera handling are heavier)

**Justification:** Embedded libraries increase file sizes. QR scanning requires heavier dependencies than generation. These sizes are acceptable for offline-first functionality and remain small enough for fast loading even on slow connections.

### Browser Compatibility

- MUST support: Chrome/Edge (Chromium), Firefox, Safari (including iOS Safari)
- ES6+ JavaScript allowed (all modern browsers support it)
- NO IE11 support required
- Camera API MUST work on iOS Safari (critical for receiver.html)
- LocalStorage API for temporary state (if needed) MUST work across browsers

### Code Organization Within HTML Files

- Use HTML comments to divide sections: `<!-- QR Generation Logic -->`, `<!-- UI Event Handlers -->`, etc.
- JavaScript organized by functional areas using comments
- CSS organized by component/section using comments
- Inline code MUST be readable with proper indentation despite embedding

## Development Workflow

### Making Changes

1. Edit HTML files directly in code editor
2. Test by opening file in browser (file:// protocol for sender.html, http://localhost for receiver.html due to camera API requirements)
3. For camera features: Use `python3 -m http.server 8000` to test locally with HTTPS context
4. Manual test across browsers before committing
5. Update README.md if user-facing functionality changes
6. Commit with clear messages describing the change

### Adding New Features

BEFORE implementing, verify the feature:
1. Can be implemented entirely within existing 3 HTML files
2. Does NOT require additional files
3. Does NOT require external dependencies (or dependency can be embedded)
4. Does NOT violate offline-first principle
5. Justified against simplicity principle (is complexity worth the value?)

If ANY check fails, redesign the feature or reject it.

### Version Control

- Use Git for version history
- Semantic versioning in README.md: MAJOR.MINOR.PATCH
- MAJOR: Breaking changes to HTML file structure or public interfaces
- MINOR: New features (e.g., new QR encoding option, UI improvement)
- PATCH: Bug fixes, minor tweaks
- Tag releases: `git tag v2.2.0`

## Governance

### Constitution Authority

This constitution supersedes all other coding practices, style guides, or architectural preferences. When in conflict, constitution principles win.

### Amendment Process

1. Propose amendment with clear rationale in .specify/memory/constitution.md
2. Update version following semantic versioning:
   - MAJOR: Removing or fundamentally changing a core principle (e.g., allowing external dependencies)
   - MINOR: Adding new principle or expanding existing guidance
   - PATCH: Clarifications, typo fixes, minor wording improvements
3. Update LAST_AMENDED_DATE to today's date
4. Propagate changes to affected templates in .specify/templates/
5. Document changes in Sync Impact Report at top of this file
6. Commit with message: `docs: amend constitution to vX.Y.Z (brief description)`

### Compliance Review

Every feature implementation, bug fix, or refactor MUST be checked against:
- ✅ Offline-First Architecture: No network dependencies added?
- ✅ Zero External Dependencies: No npm packages or build tools introduced?
- ✅ Self-Contained HTML Design: All code embedded in HTML?
- ✅ Minimal File Structure: Still only 3 HTML files + README.md?
- ✅ Embedded Functionality: No external .js/.css files created?
- ✅ Pragmatic Simplicity: Complexity justified?
- ✅ Testing: Manually tested in target browsers?

### Violations

If a feature REQUIRES violating a principle:
1. Document the violation in planning phase (plan.md Complexity Tracking section)
2. Explain why simpler alternatives are insufficient
3. Propose minimum-viable violation (e.g., if dependency needed, can it be embedded inline?)
4. Seek explicit approval before proceeding
5. Document the technical debt and future remediation plan

### Project Context Integration

For speckit workflows:
- `/speckit.specify`: Feature specs written with HTML file context (not src/ directories)
- `/speckit.plan`: Technical context reflects HTML-embedded architecture
- `/speckit.tasks`: Tasks reference HTML files directly (e.g., "Add feature to sender.html line 150-200")
- `/speckit.implement`: Implementation stays within 3-file constraint

**Version**: 1.0.0 | **Ratified**: 2025-10-13 | **Last Amended**: 2025-10-13
