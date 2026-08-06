# TODAY MASTER PROJECT
## Product Roadmap
Version: 1.0
Status: Active
Current Application Version: 2.0.0
Current Phase: Phase 2 Completed
Next Phase: Phase 3 — Native Mobile / Capacitor
Last Updated: 31 July 2026

---

# Project Vision

Today Master Project is the umbrella project that coordinates every aspect of the Today ecosystem.

It combines product development, AI, integrations, commercialization, research, store releases and long-term strategy into a single roadmap.

Visible product modules remain Today Core, Today Health and Today Sky. AI Engine and Connect are supporting system layers. Product development follows low-effort interaction, simple and non-judgmental language, privacy, user control and explainability.

---

# Master Projects

Today Master Project consists of the following subprojects:

- Today App
- Today AI Engine
- Today Connect
- TÜBİTAK BiGG
- DE02
- App Store Release
- Google Play Release
- Commercialization
- Market Validation
- User Validation

---

# Development Roadmap

## Phase 1

Foundation

Objectives

- Code inventory
- Architecture documentation
- Data model
- Storage reliability
- Backup & Restore
- Migration
- Version management
- Testing

Status

🟢 Completed

---

## Phase 2

Platform Architecture

Objectives

- Modular architecture
- Shared state
- Routing
- Data contracts
- AI Adapter
- Connect Adapter
- Performance
- Accessibility

Status

🟢 Completed

---

## Phase 3

Native Mobile

Objectives

- Capacitor
- Android
- iOS
- Push Notifications
- Secure Storage
- Haptic Feedback
- Local Notifications
- Device APIs

Status

Next / Planned

---

## Phase 4

Today Health

Objectives

- Sleep
- Water
- Exercise
- Nutrition
- Recovery
- Health Statistics

Status

⚪ Planned

---

## Phase 5

Today Sky + AI Engine

Objectives

- Sky Module
- Explainable AI
- Human in the Loop
- Pattern Recognition
- Personal Insights
- Confidence Scores

Status

⚪ Planned

---

## Phase 6

Connect + Store Release

Objectives

- Calendar
- Email
- Reminders
- Cloud Backup
- HealthKit
- Health Connect
- Beta Testing
- App Store
- Google Play

Status

⚪ Planned

---

# Parallel Workstreams

The following workstreams continue in parallel throughout all phases:

## Product

- UX
- UI
- User Experience
- Accessibility

## AI

- Today AI Engine
- AI Benchmarking
- Memory
- Planning
- Explainability

## Connect

- External Integrations
- Calendar
- Email
- Notifications

## Business

- TÜBİTAK
- DE02
- Funding
- Commercialization

## Validation

- User Interviews
- MVP Testing
- Market Research
- Competitive Analysis

---

# Success Metrics

Technical

- Stable architecture
- Low bug count
- High performance

Product

- User satisfaction
- Retention
- Simplicity

Business

- Store publication
- Funding readiness
- Market validation

---

# Project Rule

Every new feature must support at least one of the following:

- Product value
- Technical quality
- AI capability
- Commercial readiness
- User validation

Features that do not contribute to the roadmap should not be added.

---

# Phase 2 Closure — 31 July 2026

Work items

TB-011–TB-019

Delivered:

- architecture inventory and dependency/repetition map,
- centralized startup order,
- central Router and Module Registry,
- central error management,
- schema and migration orchestration,
- user-approved Service Worker update flow,
- AI and Connect adapter interfaces,
- portable local regression gate and GitHub Actions automation.

Technical baseline:

- Application version: `2.0.0`
- Data schema: `2`
- Active shell: `today-v2-foundation-012`
- Regression: **294/294 successful, 0 failures**
- GitHub Pages deployment: successful

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

---

# Phase 3 Entry — Native Mobile / Capacitor

Phase 3 will preserve the existing PWA codebase while adding native iOS and Android shells.

Planned work packages:

1. Capacitor compatibility and dependency inventory.
2. Capacitor project and platform configuration.
3. iOS/Xcode project generation and signing foundation.
4. Android/Android Studio project generation and signing foundation.
5. Local notifications and user-selected reminder time.
6. Haptic, sharing and file-system adapters.
7. Keychain/Keystore secure-storage foundation.
8. Biometric-lock foundation.
9. Calendar/reminder adapters and permission management.
10. iOS/Android device regression tests.

Entry conditions:

- Phase 2 closure documents are committed under `docs/`.
- The GitHub Actions regression gate on `main` is green.
- The live PWA and existing Core data are preserved.
- Capacitor adds only the platform shell and adapter connections; it does not duplicate application features.

---

# Detailed Direction for Later Phases

## Phase 4 — Today Health MVP

The first release is manual-first and covers sleep, water, exercise, movement, weight/measurements, energy/recovery, body notes, symptoms and basic nutrition. HealthKit and Health Connect are added later with explicit user approval.

## Phase 5 — Today Sky + AI Engine MVP

Birth information, chart summary, daily transits, important periods, personal journal and Core–Sky relationships use possibility language and avoid psychological diagnosis. AI output includes the recommendation, its basis, confidence, uncertainty and user approval.

## Phase 6 — Connect + Beta + Store Release

Calendar, email, tasks/reminders and user-controlled backup are followed by TestFlight and Play closed testing, privacy/terms documents, store forms, store materials and the release checklist.
