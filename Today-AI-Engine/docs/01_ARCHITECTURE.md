# TODAY MASTER PROJECT
## System Architecture
Version: 1.0
Status: Active
Application Version: 2.11.1
Data Schema: 2
Active Shell: today-v2-foundation-061
Last Updated: 14 August 2026

---

# 1. Project Vision

Today is a privacy-first personal life platform designed to help people understand themselves rather than measure themselves.

Core philosophy:

> "Sadece fark et."

The system combines mental, physical and temporal awareness into one platform.

---

# 2. Product Architecture

TODAY

├── Today Core
├── Today Health
├── Today Sky
│
├── AI Engine (System Layer)
└── Connect (System Layer)

Only Core, Health and Sky are visible to users.

AI Engine and Connect remain infrastructure components.

---

# 3. Visible Modules

## Today Core

Purpose

Daily awareness

Functions

• Daily check-in
• Colors
• Notes
• Calendar
• Statistics
• Personal timeline

---

## Today Health

Purpose

Body awareness

Functions

• Sleep
• Water
• Exercise
• Activity
• Nutrition
• Recovery
• Health records

---

## Today Sky

Purpose

Temporal awareness

Functions

• Natal chart
• Daily transits
• Personal sky journal
• Long-term cycles

---

# 4. System Layers

## Today AI Engine

Purpose

Interpret user data.

Responsibilities

• Context understanding
• Pattern detection
• Planning
• Prioritization
• Memory
• Explainable AI
• Human-in-the-Loop
• Benchmarking

---

## Today Connect

Purpose

Connect Today with external services.

Responsibilities

• Calendar
• Email
• Reminders
• Notifications
• HealthKit
• Health Connect
• Cloud Backup
• Device integrations

---

## NUT-017.3.1 Explainable Analysis Diagnostics

Today AI Engine remains a separate system layer. The App owns only public,
read-only source adapters and the visible consent/context-preview surface.

| Boundary | Owner | Constraint |
| --- | --- | --- |
| Core / Health / Sky records | Today App public APIs | No storage key is exposed to AI Engine |
| Data scope and one-request consent | Today App settings surface | Device-only, request-scoped, no external recipient |
| Minimization and context package | Today AI Engine NUT-017.1 | Deterministic, provenance-linked, DOM/storage/network independent |
| Symbolic Sky section | Today AI Engine | Separate from Core/Health; causality and scientific-evidence claims disabled |
| Explainable analysis | Today AI Engine NUT-017.3.1 | Provider-free deterministic rule; evidence, confidence, uncertainty, alternatives and approval state are mandatory |
| Rule mismatch diagnosis | Today AI Engine NUT-017.3.1 | Shows only validated Core/sleep observations, date checks and controlled reasons; does not relax the rule |
| Symbolic Sky in analysis | Today AI Engine NUT-017.3.1 | Never used as evidence, confidence input, mismatch input or a health/emotion cause |
| Proposed action | Existing output contract | Remains `pending-user-approval`; no approval gateway or Connect execution is invoked |

The active host integration is App `2.11.1`, schema `2`, shell
`today-v2-foundation-061`. NUT-017.3.1 preserves the second explicit user command after
the consent-gated context preview. It implements only the documented first
rule (`Core C` plus sleep below six hours), invents no result when the rule does
not match, registers no model/provider and starts no Connect operation. See
`docs/NUT-017.3.1-IMPLEMENTATION.md` for the diagnostic verification record; the source
mapping remains in `docs/NUT-017.2-IMPLEMENTATION.md`.

---

# 5. Data Principles

Default:

User data stays on device.

Future:

Optional encrypted synchronization.

No data selling.

No advertising profile.

Minimal data collection.

---

# 6. AI Principles

AI never replaces user decisions.

AI may:

• summarize

• analyze

• recommend

• explain

AI never:

• sends emails automatically

• edits calendar automatically

• changes health goals automatically

• deletes user data

Human approval is required.

---

# 7. Human in the Loop

AI

↓

Recommendation

↓

User Approval

↓

Connect

↓

Execution

---

# 8. Development Phases

Phase 1
Foundation

Phase 2
Platform Architecture

Phase 3
Native Mobile

Phase 4
Today Health

Phase 5
Today Sky + AI Engine

Phase 6
Connect + Store Release

---

# 9. Development Rules

Before every development:

• Review current version

• Review commits

• Review changelog

• Avoid duplicate implementations

• Preserve user data

• Test before commit

---

# 10. Project Management

Master Project:

Today Master Project

Subprojects:

Today App

Today AI Engine

Today Connect

Store Release

TÜBİTAK

Commercialization

Market Validation

User Validation

---

# 11. Success Criteria

A successful Today release must satisfy:

Technical quality

Privacy

Performance

Explainability

Scalability

Commercial readiness

User value

---

# 12. Phase 2 Platform Architecture Baseline

Status

🟢 Completed — 31 July 2026

Work items

TB-011–TB-019

Phase 2 extended the existing PWA without rebuilding it. Today Core, Today Health and Today Sky remain the only visible product modules. Today AI Engine and Today Connect remain system layers and cannot execute user-directed actions without explicit approval.

## Runtime Architecture

The application remains an HTML/CSS/JavaScript PWA. `index.html` is the main entry point, `sw.js` owns the offline shell, and platform responsibilities are isolated under `modules/`.

Startup order is controlled to protect user data:

1. Central error handling is prepared.
2. Storage and Version contracts are validated.
3. Data migration runs when required.
4. State is loaded safely.
5. Router and Module Registry are prepared.
6. Service Worker Manager controls registration and user-approved updates.
7. AI and Connect adapter contracts are initialized safely without providers.
8. The application becomes ready for use.

`modules/startup-manager.js` orchestrates this order without duplicating module business rules.

## Platform Modules

| Module | Responsibility |
|---|---|
| `storage.js` | Single data store, safe reads/writes and export foundation |
| `version.js` | Single source for application and schema versions |
| `migration.js` | Safe, backed-up conversion of legacy data schemas |
| `day-manager.js` | Day boundaries and daily record behavior |
| `state-manager.js` | Shared application-state contract |
| `router.js` | Central view navigation and back behavior |
| `module-registry.js` | Registration and resolution contract for Core, Health and Sky |
| `startup-manager.js` | Startup dependencies, order and safe boot |
| `error-manager.js` | Standard errors, bounded session log and recovery |
| `service-worker-manager.js` | Service Worker registration, approval-based update and error forwarding |
| `adapter-interfaces.js` | Immutable provider contracts for TodayAI and TodayConnect |

`bridge.js` is not a runtime dependency. It remains a historical/transition file and must not become the basis of new integrations.

## Data and Migration Contract

- `modules/version.js` is the single source for `APP_VERSION`.
- The current data schema is `SCHEMA_VERSION = 2`.
- Known legacy Today keys are preserved during migration.
- Supported base upgrade paths are `0 → 1 → 2` and `1 → 2`.
- One backup is created before persistent migration.
- Re-running the same migration does not write the data a second time.
- Migration failures use the existing error surface; no second visible error system is created.

## Error, Update and Offline Contract

- Unexpected `error` and `unhandledrejection` events are handled centrally.
- Technical error history exists only in session memory and is limited to 25 records.
- Journal content, user notes and application state are excluded from technical logs.
- A new Service Worker version is not activated without user approval.
- Navigation uses network-first behavior; static assets use cache-first behavior.
- Old Today cache areas are removed when a new shell becomes active.

## AI and Connect Boundary

Without a real provider, `TodayAI` and `TodayConnect` load with `available: false`. Their contracts:

- create no new visible screen,
- send no user data externally,
- perform no calendar, email, task or notification action without approval,
- preserve the existing Core, Health and Sky flows when providers are added later.

## Regression Gate

Install dependencies:

```bash
npm ci --ignore-scripts
```

Run the single platform regression gate:

```bash
npm test
```

GitHub Actions runs the same gate when `index.html`, `sw.js`, `modules/**`, `tests/**`, package files or the workflow changes.

Phase 2 result: **294/294 successful, 0 failures**. GitHub Pages deployment completed successfully. TB-019 changed only test and automation files; it did not change `index.html`, `sw.js` or `modules/**`.

## Architecture Change Rules

- Preserve the working architecture; do not rewrite the application from scratch.
- Do not implement the same responsibility twice.
- Preserve one data source, one version source and one routing behavior.
- Treat Core, Health, Sky, Calendar, Statistics and Settings as regression-protected flows.
- Before every new phase, review the current version, commit, CHANGELOG and backlog.

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**
