# TODAY MASTER PROJECT
## Technical Backlog

Document: Technical Backlog
Version: 1.0
Status: Active
Owner: Today Master Project
Current Phase: NUT-018 — Teknik stabilizasyon
Next Phase: Test kapsamı, bağımlılıklar ve gerçek tarayıcı/PWA hazırlığı
Last Updated: 29 October 2026

---

# Purpose

This document tracks technical improvements, refactoring tasks, and engineering work required to maintain a reliable and scalable Today platform.

---

# Phase 1 — Foundation

## TB-001
Title: Remove duplicated HTML elements

Priority: High

Status: 🟢 Completed

Description:

Remove duplicated UI elements such as repeated navigation components and duplicated element IDs.

Completed Work:

- Removed duplicated Core action row.

- Removed duplicated `btnResetToday` element.

- Removed duplicated `statusPick` element.

- Removed duplicated Core bottom navigation.

Commit:

refactor: remove duplicated core html structure

---

## TB-002
Title: Unify Event Listeners

Priority: High

Status: 🟢 Completed

Description:

Ensure every user interaction is handled by a single event listener.

---

## TB-003
Title: Single Source of Truth

Priority: Critical

Status: 🟢 Completed

Description:

Choose one storage architecture as the primary data source and migrate legacy structures if required.

---

## TB-004
Title: Version Management

Priority: High

Status: 🟢 Completed

Description:

Unify application version management across HTML, JavaScript and Service Worker.

---

## TB-005
Title: Backup & Restore Validation

Priority: High

Status: 🟢 Completed

Description:

Verify backup and restore workflows using real application data.

---

## TB-006
Title: Migration Validation

Priority: Medium

Status: 🟢 Completed

Description:

Validate migration logic and ensure backward compatibility.

---

## TB-007
Title: Code Cleanup

Priority: Medium

Status: 🟢 Completed

Description:

Remove dead code, unused files and obsolete functions.

---

## TB-008
Title: Performance Review

Priority: Medium

Status: 🟢 Completed

Description:

Review startup performance, rendering and storage operations.

---

## TB-009
Title: Accessibility Review

Priority: Medium

Status: 🟢 Completed

Description:

Improve accessibility and semantic HTML where needed.

---

## TB-010
Title: Foundation Testing

Priority: Critical

Status: 🟢 Completed

Description:

Execute full regression tests after all Phase 1 tasks are completed.

---

# Phase 1 Closure

Work items

TB-001–TB-010

Result

🟢 Completed

> Faz 1 geliştirmeleri tamamlandı. Test edildi. Sonuç: Başarılı.

---

# Phase 2 — Platform Architecture

## TB-011
Title: Architecture Inventory

Priority: Critical

Status: 🟢 Completed

Acceptance:

Working files, data keys, dependencies and repetition risks are documented without changing source code.

---

## TB-012
Title: Startup Manager

Priority: Critical

Status: 🟢 Completed

Acceptance:

Critical modules start in one validated order behind a safe failure gate.

---

## TB-013
Title: Router

Priority: High

Status: 🟢 Completed

Acceptance:

Views and back behavior are managed from one central routing contract.

---

## TB-014
Title: Module Registry

Priority: High

Status: 🟢 Completed

Acceptance:

Core, Health and Sky use one registration and resolution contract.

---

## TB-015
Title: Central Error Manager

Priority: Critical

Status: 🟢 Completed

Acceptance:

Errors are standardized, privacy-preserving, bounded and recoverable.

---

## TB-016
Title: Schema and Migration Orchestration

Priority: Critical

Status: 🟢 Completed

Acceptance:

`0 → 1 → 2` and `1 → 2` upgrades preserve data, create one backup and do not repeat writes.

---

## TB-017
Title: Service Worker Update Manager

Priority: High

Status: 🟢 Completed

Acceptance:

Updates require user approval and old Today cache areas are removed safely.

---

## TB-018
Title: AI and Connect Adapter Interfaces

Priority: High

Status: 🟢 Completed

Acceptance:

The provider-free state is safe and creates no new visible screen, external transfer or unapproved action.

---

## TB-019
Title: Platform Regression and GitHub Actions

Priority: Critical

Status: 🟢 Completed

Acceptance:

The portable `npm test` gate completes on GitHub Actions with **294/294 successful, 0 failures**. The TB-019 commit changes only test and automation files and preserves `index.html`, `sw.js` and `modules/**`.

Phase 2 Closure

> **Faz 2 geliştirmeleri tamamlandı. GitHub Actions üzerinde test edildi. Sonuç: Başarılı.**

---

# Aktif teknik sıra — NUT-018

Sürekli geliştirme ortamı Codex'tir. Kullanıcı verileri/şemaları ve mevcut modüller korunur; main'e doğrudan yazılmaz, taslak PR #1 otomatik birleştirilmez.

| İş | Kapsam | Durum / kabul ölçütü |
|---|---|---|
| NUT-018 | İlk CI kök nedeni, başlangıç kapısı, güncel regresyon referansları | Tamamlandı: ea2f99d, Actions 40933274467 başarılı; platform 1116, AI 335, entegrasyon 96, benchmark 16 PASS |
| NUT-018.1 | Eksik Health Hub / tüketim editörü testleri ve kayıtlı test envanteri | Yerelde doğrulandı: 25 grup / 1155 PASS; AI 335, entegrasyon 96, benchmark 16 PASS. CI kaydı PR #1'de |
| NUT-018.2 | Bağımlılık güvenliği ve aktif sürüm tutarlılığı | Doğrulandı: df47b0e / Actions 40938911892; audit 0, paket/aktif sürüm 2.16.0; 1155/335/96/16 PASS |
| NUT-018.3 | Gerçek tarayıcı otomasyonu ve iPhone PWA doğrulama hazırlığı | Hazırlık uygulandı: Chromium 6 PASS, platform 1156 PASS; Chromium/WebKit CI kanıtı PR #1'de. Fiziksel iPhone/Android kabulü bekliyor |
| NUT-019.1 | Günlük / 7 / 30 / 90 günlük gözlemler; saat adaptör sözleşmesi | Yerel 1156/364/112/16 kapıları ve yeni Chromium senaryosu başarılı. Gerçek saat okuma ve telefon bildirimi bağlı değildir; kayıt docs/NUT-019.1-IMPLEMENTATION.md içinde. |
| NUT-019.2 | Health kişisel sağlık verisi native bağlantısı ve bildirim taşıyıcısı | Açık: kapsam/metin sözleşmesi ve 019.2.1 SDK/Health önizleme dilimi var. Health–AI bağlantısı ve izinli yerel zamanlayıcı uygulandı; fiziksel saat kabulü ve gerçek bildirim teslimi bekliyor. Tüm model/sürüm garantisi verilmez; kapsam docs/NUT-019.2-COMPATIBILITY.md içinde. |
| NUT-019.2.1 | İnce native preview, dar SDK okuyucusu ve kişisel veri ekranı | App 2.18.0, şema 2, foundation-072/117 dosya. Sağlık verisi yalnız istek belleğinde; kaynak/merged manifest/native derleme ve tarayıcı kanıtı docs/NUT-019.2-IMPLEMENTATION.md ile PR #1'de. Fiziksel cihaz testi değildir. |
| NUT-019.2.2 | Saat önizlemesinden ayrı AI onayı, kaynak anlamı ve Android cihaz paketi | App 2.19.0, şema 2, foundation-073/118 kayıt. Kalıcı yeni depo yok; geçici saat türleri manuel kayıtlardan ayrılır. Kod/test/CI kanıtı docs/NUT-019.2.2-IMPLEMENTATION.md ve PR #1'de. APK ve cihaz rehberi fiziksel kabul yerine geçmez. |
| NUT-019.3 | Günlük AI ve güncelleme OS bildirimi | Kullanıcı onaylı today_ai_delivery_v1 arşivi, native yerel bildirim adaptörü, tekilleştirme/sessiz saat/geri çekme ve UI uygulandı. Test/CI durumu docs/NUT-019.3-IMPLEMENTATION.md içinde; fiziksel teslim açık. Hazır gözlem yokken mesaj planlanmaz. |

Tam modül yedekleme/geri yükleme, veri kaybı sınırları ve gizlilik bilgilendirmesi doğrulanmadan gerçek kişilerle pilot başlatılmaz. Yeni model sağlayıcısı, dış aktarım, hesap/senkronizasyon ve şema değişiklikleri ayrı karar gerektirir. Güncel ürün kapıları docs/02_ROADMAP.md ve docs/03_PHASES.md içindedir.

# Phase 3 — Native Mobile / Capacitor (önceki aday planı)

Aşağıdaki liste korunmuş teknik envanterdir. Mağaza hazırlığı kişisel kullanım ve pazar doğrulamasından sonra gelir. 30 Ekim kullanıcının istediği saat bağlantısı için dar native sağlık köprüsü NUT-019.2 kapsamında öne alınır; bu tam native yeniden yazım veya mağaza yayını kararı değildir.

Phase 3 task IDs will be finalized only after technical discovery and a fresh repository review. Application code must not change before the relevant backlog ID is assigned.

| Proposed order | Work package | Status |
|---:|---|---|
| 1 | Capacitor compatibility and dependency inventory | Next |
| 2 | Capacitor base configuration | Planned |
| 3 | iOS/Xcode project and signing foundation | Planned |
| 4 | Android/Android Studio project and signing foundation | Planned |
| 5 | Local notifications and user-selected reminder time | Planned |
| 6 | Haptic, sharing and file-system adapters | Planned |
| 7 | Keychain/Keystore secure-storage foundation | Planned |
| 8 | Biometric-lock foundation | Planned |
| 9 | Calendar/reminder adapters and permission management | Planned |
| 10 | iOS/Android device regression | Planned |

---

# Required Pre-change Check

Before every new technical work item:

1. Review `main`, the latest commit and the GitHub Actions result.
2. Read `docs/04_CHANGELOG.md` and this backlog.
3. Search existing modules for the same responsibility.
4. Preserve one data source and `modules/version.js` as the single version source.
5. Do not add a second listener to the same button, a copied view or a second export flow.
6. Do not mark production work complete until `npm test` passes.

---

# Workflow

Each task follows:

Analysis

↓

Implementation

↓

Testing

↓

Documentation

↓

CHANGELOG

↓

Commit

↓

Review

---

# Status Legend

⚪ Planned

🟡 In Progress

🟢 Completed

🔴 Blocked
