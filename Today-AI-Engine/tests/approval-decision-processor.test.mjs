import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  APPROVAL_DECISION_SCHEMA_VERSION,
  ENGINE_VERSION,
  RULESET_ID,
  processApprovalDecision
} from "../src/approval-decision-processor.mjs";

const clone = value => JSON.parse(JSON.stringify(value));

function request(overrides = {}) {
  return {
    schemaVersion: 1,
    decisionId: "decision:nut-017.4:synthetic-001",
    analysisId: "analysis:nut-017.3.1:synthetic-001",
    action: {
      actionId: "action:analysis:nut-017.3.1:synthetic-001:sleep-preparation",
      type: "create-reminder",
      label: "Uyku hazırlığını hatırla",
      status: "pending-user-approval"
    },
    decision: "approved",
    decidedAt: "2040-01-16T12:05:00.000Z",
    ...overrides
  };
}

export async function runApprovalDecisionProcessorTests() {
  const schema = JSON.parse(await readFile(
    new URL("../contracts/approval-decision.schema.json", import.meta.url),
    "utf8"
  ));
  const source = await readFile(
    new URL("../src/approval-decision-processor.mjs", import.meta.url),
    "utf8"
  );
  let checks = 0;

  const check = (condition, message) => {
    assert.ok(condition, message);
    checks += 1;
  };
  const equal = (actual, expected, message) => {
    assert.equal(actual, expected, message);
    checks += 1;
  };
  const deepEqual = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks += 1;
  };

  equal(ENGINE_VERSION, "0.4.0-approval", "Engine sürümü NUT-017.4 olmalı");
  equal(
    RULESET_ID,
    "today:approval-decision:nut-017.4",
    "Karar kuralları sabit kimlik taşımalı"
  );
  equal(
    APPROVAL_DECISION_SCHEMA_VERSION,
    schema.properties.schemaVersion.const,
    "Karar sözleşmesi sürümü mevcut şemayla eşleşmeli"
  );

  const approved = processApprovalDecision(request());
  equal(approved.ok, true, "Onay kararı kabul edilmeli");
  check(
    schema.required.every(field => Object.hasOwn(approved.decision, field)),
    "Onay kaydı sözleşmenin zorunlu alanlarını taşımalı"
  );
  equal(approved.decision.decision, "approved", "Onay kaydı approved olmalı");
  equal(approved.actionState.status, "approved", "Taslak onaylandı durumuna geçmeli");
  equal(approved.replacementAction, null, "Onay yeni taslak oluşturmamalı");
  check(
    Object.isFrozen(approved) && Object.isFrozen(approved.decision),
    "Karar sonucu derin dondurulmalı"
  );
  deepEqual(
    approved.processing,
    {
      mode: "device-only",
      retention: "request-scoped",
      externalRecipient: null
    },
    "Karar yalnız cihazda ve tek istek kapsamında kalmalı"
  );
  equal(approved.executionRequested, false, "Onay eylem yürütmemeli");
  equal(approved.auditPersisted, false, "Onay kalıcı audit yazmamalı");
  equal(approved.externalTransfer, false, "Onay cihaz dışına çıkmamalı");

  const rejected = processApprovalDecision(request({
    decisionId: "decision:nut-017.4:synthetic-002",
    decision: "rejected"
  }));
  equal(rejected.ok, true, "Ret kararı kabul edilmeli");
  equal(rejected.actionState.status, "rejected", "Taslak reddedildi durumuna geçmeli");

  const editedRequest = request({
    decisionId: "decision:nut-017.4:synthetic-003",
    decision: "edited",
    editedPayload: { reminderTime: "22:30" }
  });
  const edited = processApprovalDecision(editedRequest);
  equal(edited.ok, true, "Geçerli saat düzenlemesi kabul edilmeli");
  deepEqual(
    edited.decision.editedPayload,
    { reminderTime: "22:30" },
    "Düzenleme kararı yalnız izinli alanı taşımalı"
  );
  equal(
    edited.replacementAction.status,
    "pending-user-approval",
    "Düzenlenen taslak yeniden onay beklemeli"
  );
  equal(
    edited.replacementAction.label,
    "Uyku hazırlığını 22:30 için hatırla",
    "Yeni taslak kullanıcıya anlaşılır saat göstermeli"
  );
  equal(
    edited.replacementAction.actionId.includes(editedRequest.action.actionId),
    false,
    "Yeni taslak kimliği eski uzun kimliği çoğaltmamalı"
  );
  deepEqual(
    processApprovalDecision(editedRequest),
    edited,
    "Aynı karar isteği deterministik sonuç üretmeli"
  );

  equal(
    processApprovalDecision(request({
      decision: "edited",
      editedPayload: { reminderTime: "25:90" }
    })).error.code,
    "invalid-approval-decision",
    "Geçersiz saat reddedilmeli"
  );
  equal(
    processApprovalDecision(request({
      decision: "edited",
      editedPayload: { reminderTime: "22:30", note: "fazla alan" }
    })).error.code,
    "invalid-approval-decision",
    "Düzenleme fazladan alan kabul etmemeli"
  );
  equal(
    processApprovalDecision(request({ editedPayload: { reminderTime: "22:30" } }))
      .error.code,
    "invalid-approval-decision",
    "Onay kararı düzenleme verisi taşıyamamalı"
  );

  const alreadyDecided = request();
  alreadyDecided.action.status = "approved";
  equal(
    processApprovalDecision(alreadyDecided).error.code,
    "invalid-approval-decision",
    "Sonuçlanmış eylem yeniden karara açılamamalı"
  );

  const extraRequestField = clone(request());
  extraRequestField.storageKey = "todayStore";
  equal(
    processApprovalDecision(extraRequestField).error.code,
    "invalid-approval-decision",
    "Karar sınırı bilinmeyen alanları reddetmeli"
  );
  equal(
    processApprovalDecision(request({ decidedAt: "geçersiz" })).error.code,
    "invalid-approval-decision",
    "Geçersiz karar zamanı reddedilmeli"
  );
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf karar katmanı DOM, depolama, ağ, Connect veya sistem saati kullanmamalı"
  );

  return checks;
}
