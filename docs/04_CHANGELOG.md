# TODAY MASTER PROJECT
## CHANGELOG

Document: Changelog
Version: 1.0
Status: Active
Owner: Today Master Project
Last Updated: 14 August 2026

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

## Version 2.15.0 — NUT-017.7

Date

14 August 2026

Phase

AI pattern feedback checkpoint

Status

🟡 NUT-017.7 completed; product phase closure not claimed

Summary

- Added versioned `pattern-feedback` and `pattern-feedback-receipt` v1 contracts.
- Added a pure deterministic processor that accepts only three explicit user responses linked to a valid NUT-017.6 observation.
- Rejected observations whose evidence, confidence, approval, causality, diagnosis, Sky, action or retention boundaries were changed.
- Added “Bana uyuyor”, “Bana uymuyor” and “Emin değilim” to the successful seven-day observation card.
- Kept technical feedback, receipt and observation identifiers out of the user surface.
- Kept only the latest choice in memory for the current screen request; reset it on a new preview, clear or reload.
- Kept observation/confidence changes, model learning, persistent memory, action execution, Connect, persistent audit and external transfer disabled.
- Raised App to `2.15.0` and shell to `today-v2-foundation-066`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **232/232 successful**.
- NUT-017.7 App gate: **83/83 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can tell Today whether the displayed seven-day observation feels applicable without turning that response into a learned fact, permanent preference or external action.

Commit

`feat(ai): add request-scoped pattern feedback (NUT-017.7)`

---

## Version 2.14.0 — NUT-017.6

Date

14 August 2026

Phase

AI multi-day pattern observation checkpoint

Status

🟡 NUT-017.6 completed; product phase closure not claimed

Summary

- Added versioned `pattern-observation-request` and `pattern-observation-output` v1 contracts.
- Added a pure, deterministic seven-day observer for same-local-date Core `C` and sleep-below-six-hours recurrence.
- Required at least three comparable Core/sleep days and at least two matching days; otherwise no pattern is invented.
- Added provenance-linked evidence, observation strength, uncertainty, options and an explicit no-approval state.
- Defined observation strength as window coverage plus recurrence, not a probability of truth.
- Added a separate, plain-language “Son 7 güne bak” command and observation card.
- Kept internal event IDs and NUT/ruleset/schema codes out of the user surface.
- Kept Sky outside matching, evidence, confidence and health/emotion causality.
- Kept action proposals, Connect, persistent audit, storage writes and external transfer disabled.
- Raised App to `2.14.0` and shell to `today-v2-foundation-065`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **185/185 successful**.
- NUT-017.6 App gate: **73/73 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can separately inspect whether the documented Core/sleep combination recurred during the last seven days. The output describes co-occurrence only; it does not claim cause, diagnosis, prediction or action.

Commit

`feat(ai): add explainable seven-day pattern observation (NUT-017.6)`

---

## Version 2.13.0 — NUT-017.5

Date

14 August 2026

Phase

AI decision receipt checkpoint

Status

🟡 NUT-017.5 completed; product phase closure not claimed

Summary

- Added the versioned `decision-receipt` v1 contract and a pure deterministic receipt builder.
- Linked each validated approve, reject or edit decision to its analysis and proposed action inside the internal contract.
- Added a collapsed, plain-language “Karar geçmişi” visible only during the current screen request.
- Reset the temporary history on a new preview, clear or page reload.
- Kept internal receipt, decision, analysis and action IDs out of the user interface.
- Kept edited drafts pending another explicit approval.
- Kept action execution, Connect, persistent audit, storage writes and external transfer disabled.
- Raised App to `2.13.0` and shell to `today-v2-foundation-064`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **145/145 successful**.
- NUT-017.5 App gate: **63/63 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Existing platform baseline remained unchanged: static **25/30**, Service Worker event **23/36**, browser **47/48**; automation contract still lacks `.github/workflows/platform-regression.yml`.

Result

The user can see a concise receipt for each decision made during the current suggestion request. A receipt records intent only; it does not mean that a reminder or external action has happened and it is not persisted.

Commit

`feat(ai): add request-scoped decision receipts (NUT-017.5)`

---

## Version 2.12.0 — NUT-017.4

Date

14 August 2026

Phase

AI suggestion decision checkpoint

Status

🟡 NUT-017.4 completed; product phase closure not claimed

Summary

- Reused the existing approval-decision v1 contract for request-scoped approve, reject and edit decisions.
- Added a pure AI Engine decision processor and a DOM/storage/network-independent App bridge.
- Made editing create a new pending reminder draft that requires another explicit approval.
- Simplified the user surface and removed internal event IDs, NUT/rule IDs and filtering reason codes from visible copy.
- Preserved evidence, confidence, uncertainty, alternatives and approval state while translating confidence into plain language.
- Kept Sky symbolic and outside evidence, confidence and health/emotion causality.
- Kept Connect execution, persistent audit, external transfer and permanent AI memory disabled.
- Raised App to `2.12.0` and shell to `today-v2-foundation-063`; schema remains `2` with no migration or new storage key.

Tests

- AI Engine: **114/114 successful**.
- NUT-017.4 App gate: **61/61 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing startup/empty-store expectation failure.

Result

The user can now approve, reject or edit a suggestion in clear language. The decision remains in memory for the current request and never implies that a reminder or external action has been performed.

Commit

`feat(ai): add request-scoped suggestion decisions (NUT-017.4)`

---

## Version 2.11.2 — NUT-017.3.2

Date

14 August 2026

Phase

AI context source-adapter correction

Status

🟡 NUT-017.3.2 completed; product phase closure not claimed

Summary

- Fixed source-cap selection that retained the oldest Health events and could exclude a newly saved sleep record.
- Changed bounded source selection to keep the newest deterministic subset and then restore chronological output order.
- Changed the Health public context view to retain the newest records per type when its own limit is reached.
- Added a regression in which an approved current sleep event must survive older Health-event pressure.
- Kept the NUT-017.3.1 rule, diagnostics and AI Engine `0.3.1-analysis` unchanged.
- Kept Sky symbolic and outside evidence, confidence, mismatch checks and health/emotion causality.
- Raised App to `2.11.2` and shell to `today-v2-foundation-062`; schema remains `2` with no migration.

Tests

- AI Engine: **86/86 successful** (unchanged Engine).
- NUT-017.3.2 App gate: **50/50 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing startup/empty-store expectation failure.

Result

The latest approved sleep record can no longer be displaced by older Health events solely because the per-source limit is reached. No live model/provider, approval execution, audit write or Connect action was introduced.

Commit

`fix(ai): retain latest health context records (NUT-017.3.2)`

---

## Version 2.11.1 — NUT-017.3.1

Date

14 August 2026

Phase

AI Engine explainable-analysis correction

Status

🟡 NUT-017.3.1 completed; product phase closure not claimed

Summary

- Added deterministic mismatch diagnostics for the existing first rule.
- Displayed the selected latest Core choice, sleep duration, local dates and controlled rejection reason.
- Preserved the strict `Core=C`, sleep `<360 minutes`, same-local-date rule.
- Kept invalid requests fail-closed without diagnostic data exposure.
- Kept Sky outside evidence, confidence, diagnostics and health/emotion reasoning.
- Raised App to `2.11.1` and shell to `today-v2-foundation-061`; schema remains `2` with no migration.

Tests

- AI Engine: **86/86 successful**.
- NUT-017.3.1 App gate: **49/49 successful**.
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.

Result

The previously opaque no-match result now explains exactly which approved rule input failed. No live model/provider, approval execution, audit write or Connect action was introduced.

Commit

`fix(ai): expose deterministic rule mismatch diagnostics (NUT-017.3.1)`

---

## Version 2.11.0 — NUT-017.3

Date

14 August 2026

Phase

AI Engine explainable analysis preparation

Status

🟡 NUT-017.3 completed; product phase closure not claimed

Summary

- Added a provider-free, deterministic and device-only daily support analyzer.
- Added the versioned `analysis-request` contract while preserving the existing `analysis-output` contract.
- Implemented only the documented first rule: Core `C` plus sleep below six hours.
- Added a separate explicit command after the consent-gated context preview.
- Rendered evidence, confidence, uncertainty, alternatives and approval state.
- Kept Sky out of evidence, confidence and health/emotion reasoning even when symbolic context is selected.
- Kept proposed actions at `pending-user-approval`; no approval gateway, audit writer or Connect execution was added.
- Raised the offline shell from `today-v2-foundation-059` to `today-v2-foundation-060`.
- Kept the Today data schema at `2`; no migration was added.

Files Changed

- `Today-AI-Engine/contracts/analysis-request.schema.json`
- `Today-AI-Engine/src/daily-support-analyzer.mjs`
- `Today-AI-Engine/tests/daily-support-analyzer.test.mjs`
- `modules/ai-analysis-bridge.mjs`
- `modules/ai-context-ui.mjs`
- `index.html`
- `sw.js`
- `modules/version.js`
- `modules/storage.js`
- `tests/ai-analysis-bridge.test.mjs`
- `tests/ai-context-ui.test.mjs`
- `tests/run-nut-017.3.cjs`
- `docs/NUT-017.3-IMPLEMENTATION.md`
- AI Engine and Today architecture/changelog documents

Tests

- NUT-017.3 App gate: **48/48 successful**.
- AI Engine: **80/80 successful** (`10` foundation + `41` context/consent + `29` explainable analysis).
- Existing Adapter, Migration, Router, Startup and Service Worker Manager groups: **142/142 successful**.
- Browser baseline: **47/48**, preserving the pre-existing single failure.
- Legacy general gate: **1089/1116 individual checks successful**, but failed as a gate because the same four stale groups remain unresolved.

Result

NUT-017.3 successful. No phase closure claimed. No live model/provider or executable action was introduced.

Commit

`feat(ai): add deterministic explainable analysis preview (NUT-017.3)`

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
