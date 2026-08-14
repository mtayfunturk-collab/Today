# TODAY MASTER PROJECT
## CHANGELOG

Document: Changelog
Version: 1.0
Status: Active
Owner: Today Master Project
Last Updated: 13 August 2026

---

# Changelog Rules

Every meaningful change in the project must be recorded here.

Each entry should include:

- Date
- Version
- Phase
- Module
- Summary
- Files Changed
- Tests
- Result
- Commit Message

---

# Version History

---

## Version 2.10.0 — NUT-017.2

Date

13 August 2026

Phase

AI Engine integration preparation

Status

🟡 NUT-017.2 completed; product phase closure not claimed

Summary

- Added read-only Core, Health, Nutrition and optional Core–Sky event adapters.
- Added purpose-bound, one-request, device-only data usage consent in Settings.
- Added a context preview backed by the unchanged NUT-017.1 Context Builder.
- Kept Sky symbolic, separate from Core/Health and non-causal.
- Did not register an AI provider, generate a recommendation or start Connect.
- Raised the offline shell from `today-v2-foundation-058` to `today-v2-foundation-059`.
- Kept the Today data schema at `2`; no migration was added.

Files Changed

- `index.html`
- `sw.js`
- `modules/version.js`
- `modules/storage.js`
- `modules/health-hub.js`
- `modules/ai-context-source-adapters.js`
- `modules/ai-context-bridge.mjs`
- `modules/ai-context-ui.mjs`
- `tests/ai-context-*.test.*`
- `tests/run-nut-017.2.cjs`
- `tests/platform-browser-regression.test.cjs`
- `docs/NUT-017.2-IMPLEMENTATION.md`
- `docs/01_ARCHITECTURE.md`
- `docs/04_CHANGELOG.md`
- `Today-AI-Engine/README.md`
- `Today-AI-Engine/CHANGELOG.md`
- `Today-AI-Engine/docs/ARCHITECTURE.md`
- `Today-AI-Engine/docs/PHASES.md`

Tests

- NUT-017.2: **35/35 successful**.
- AI Engine: **51/51 successful**.
- Existing Adapter, Router, Startup and Service Worker Manager groups: **101/101 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.
- Legacy general gate: **1089/1116 individual checks successful**, but failed as a gate because four stale groups remain unresolved.

Result

NUT-017.2 successful. No phase closure claimed.

Commit

`feat(ai): add consent-gated context preview (NUT-017.2)`

---

## Version 2.0.0

Date

31 July 2026

Phase

Phase 2 — Platform Architecture

Status

🟢 Completed

Summary

- **TB-011:** Inventoried the working architecture, data flows, dependencies and repetition risks.
- **TB-012:** Added Startup Manager for dependency validation and safe application boot.
- **TB-013:** Added the central Router for view transitions and back behavior.
- **TB-014:** Added the central Module Registry for Core, Health and Sky.
- **TB-015:** Added Central Error Manager for safe `error` and `unhandledrejection` handling.
- **TB-016:** Added backed-up, repeat-safe migration orchestration for `0 → 1 → 2` and `1 → 2`.
- **TB-017:** Added user-approved Service Worker updates and old-cache cleanup.
- **TB-018:** Added safe, immutable TodayAI and TodayConnect adapter contracts for the provider-free state.
- **TB-019:** Added the portable `npm test` regression gate and GitHub Actions workflow.

Changed

- Centralized the startup sequence around validated dependencies.
- Separated routing, module resolution, error handling and Service Worker registration into single-responsibility modules.
- Raised the active application shell to `today-v2-foundation-012`.
- Centralized application version `2.0.0` and data schema `2` under `modules/version.js`.

Preserved

- Today Core, Today Health and Today Sky user flows.
- Calendar, Statistics and Settings views.
- Existing data keys, theme, CSV export and edit behavior.
- Router back behavior and visible product language.
- Local-first operation, data minimization and user control.

Files Changed Across Phase 2

- index.html
- sw.js
- modules/startup-manager.js
- modules/router.js
- modules/module-registry.js
- modules/error-manager.js
- modules/migration.js
- modules/service-worker-manager.js
- modules/adapter-interfaces.js
- package.json
- package-lock.json
- tests/**
- .github/workflows/platform-regression.yml
- docs/01_ARCHITECTURE.md
- docs/02_ROADMAP.md
- docs/03_PHASES.md
- docs/04_CHANGELOG.md
- docs/10_TECHNICAL_BACKLOG.md

Tests

- GitHub Actions: **294/294 successful, 0 failures**.
- GitHub Pages deployment: successful.
- TB-019 changed only test and automation files; `index.html`, `sw.js` and `modules/**` remained unchanged from TB-018.

Result

Successful

Closure

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

Commit

test(platform): enable TB-019 automated regression gate

---

## Phase 1 Closure — TB-001–TB-010

Status

🟢 Completed

Summary

- Duplicate Core markup and duplicate IDs were removed.
- Event-listener ownership was unified.
- Storage and state were moved toward a single source of truth.
- Version management was centralized.
- Backup/restore and migration behavior were validated.
- Dead-code, performance and accessibility reviews were completed.
- Foundation regression testing completed successfully.

Result

Successful

Closure

> Faz 1 geliştirmeleri tamamlandı. Test edildi. Sonuç: Başarılı.

---

## Version 10-APP-003

Date

29 July 2026

Phase

Phase 1 – Foundation

Status

🟡 In Progress

Summary

- Today Master Project initiated.
- Development phases defined.
- Architecture documentation started.
- Roadmap documentation created.
- Phase management introduced.
- Changelog system initialized.

Modules

- Core
- Documentation

Files

- docs/01_ARCHITECTURE.md
- docs/02_ROADMAP.md
- docs/03_PHASES.md
- docs/04_CHANGELOG.md

Tests

Documentation review completed.

Result

In Progress

Commits

docs: add initial Today Master Project architecture

docs: add Today Master Project roadmap

docs: add development phases tracker

docs: initialize project changelog

---

# Future Entry Template

## Version

Date

Phase

Status

Summary

Modules

Files Changed

Tests

Result

Commit Message

---

## TB-001 — Duplicate HTML Cleanup

Date

29 July 2026

Phase

Phase 1 – Foundation

Summary

- Removed duplicated Core action row.

- Removed duplicated Core bottom navigation.

- Removed duplicated `btnResetToday`.

- Removed duplicated `statusPick`.

Files Changed

- index.html

Tests

- Home

- Module Center

- Today Core

- Health

- Sky

- Calendar

Result

Successful

Commit

refactor: remove duplicated core html structure
