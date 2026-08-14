import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { processApprovalDecision } from "../src/approval-decision-processor.mjs";
import {
  DECISION_RECEIPT_SCHEMA_VERSION,
  ENGINE_VERSION,
  EVENT_TYPE,
  RULESET_ID,
  buildDecisionReceipt
} from "../src/decision-receipt-builder.mjs";

const clone = value => JSON.parse(JSON.stringify(value));

function decisionResult(decision = "approved", editedPayload) {
  return processApprovalDecision({
    schemaVersion: 1,
    decisionId: `decision:nut-017.5:${decision}-001`,
    analysisId: "analysis:nut-017.4:synthetic-001",
    action: {
      actionId: "action:analysis:nut-017.4:synthetic-001:sleep-preparation",
      type: "create-reminder",
      label: "Uyku hazırlığını hatırla",
      status: "pending-user-approval"
    },
    decision,
    decidedAt: "2040-01-16T12:10:00.000Z",
    ...(editedPayload === undefined ? {} : { editedPayload })
  });
}

function requestFrom(result) {
  return {
    decision: result.decision,
    actionState: result.actionState,
    replacementAction: result.replacementAction,
    processing: result.processing,
    executionRequested: result.executionRequested,
    auditPersisted: result.auditPersisted,
    externalTransfer: result.externalTransfer
  };
}

export async function runDecisionReceiptBuilderTests() {
  const schema = JSON.parse(await readFile(
    new URL("../contracts/decision-receipt.schema.json", import.meta.url),
    "utf8"
  ));
  const source = await readFile(
    new URL("../src/decision-receipt-builder.mjs", import.meta.url),
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

  equal(ENGINE_VERSION, "0.5.0-receipt", "Makbuz Engine sürümü doğru olmalı");
  equal(RULESET_ID, "today:decision-receipt:nut-017.5", "Kural kimliği sabit olmalı");
  equal(EVENT_TYPE, "user-decision-recorded", "Olay türü sabit olmalı");
  equal(
    DECISION_RECEIPT_SCHEMA_VERSION,
    schema.properties.schemaVersion.const,
    "Makbuz şema sürümü sözleşmeyle eşleşmeli"
  );

  const approvedRequest = requestFrom(decisionResult("approved"));
  const approved = buildDecisionReceipt(approvedRequest);
  equal(approved.ok, true, "Onay sonucu makbuza dönüşmeli");
  check(
    schema.required.every(field => Object.hasOwn(approved.receipt, field)),
    "Makbuz sözleşmenin zorunlu alanlarını taşımalı"
  );
  equal(approved.receipt.outcome, "approved", "Onay sonucu korunmalı");
  equal(approved.receipt.actor, "user", "Karar aktörü kullanıcı olmalı");
  equal(
    approved.receipt.occurredAt,
    approvedRequest.decision.decidedAt,
    "Makbuz yeni saat üretmeden karar zamanını kullanmalı"
  );
  equal(
    approved.receipt.actionStatus,
    "approved",
    "Onaylanan eylem durumu izlenebilir olmalı"
  );
  equal(
    Object.hasOwn(approved.receipt, "replacementActionId"),
    false,
    "Onay makbuzu yeni taslak kimliği taşımamalı"
  );
  deepEqual(
    approved.receipt.scope,
    {
      processingMode: "device-only",
      retention: "request-scoped",
      persistent: false,
      externalRecipient: null
    },
    "Makbuz yalnız cihazda ve tek istek kapsamında kalmalı"
  );
  deepEqual(
    approved.receipt.effects,
    {
      actionExecuted: false,
      connectCalled: false,
      auditPersisted: false,
      externalTransfer: false,
      replacementRequiresApproval: false
    },
    "Onay makbuzu yapılmayan etkileri açıkça taşımalı"
  );
  check(
    Object.isFrozen(approved) &&
      Object.isFrozen(approved.receipt) &&
      Object.isFrozen(approved.receipt.effects),
    "Makbuz sonucu derin dondurulmalı"
  );
  deepEqual(
    buildDecisionReceipt(approvedRequest),
    approved,
    "Aynı karar sonucu deterministik makbuz üretmeli"
  );

  const rejected = buildDecisionReceipt(requestFrom(decisionResult("rejected")));
  equal(rejected.ok, true, "Ret sonucu makbuza dönüşmeli");
  equal(rejected.receipt.outcome, "rejected", "Ret sonucu korunmalı");
  equal(rejected.receipt.effects.actionExecuted, false, "Ret eylem yürütmemeli");

  const editedResult = decisionResult(
    "edited",
    { reminderTime: "22:15" }
  );
  const edited = buildDecisionReceipt(requestFrom(editedResult));
  equal(edited.ok, true, "Düzenleme sonucu makbuza dönüşmeli");
  equal(edited.receipt.outcome, "edited", "Düzenleme sonucu korunmalı");
  equal(
    edited.receipt.replacementActionId,
    editedResult.replacementAction.actionId,
    "Yeni taslak kimliği iç makbuzda izlenebilir olmalı"
  );
  equal(
    edited.receipt.effects.replacementRequiresApproval,
    true,
    "Düzenleme sonrası yeniden onay zorunlu olmalı"
  );
  equal(edited.receipt.effects.connectCalled, false, "Düzenleme Connect çağırmamalı");

  const executionTamper = clone(approvedRequest);
  executionTamper.executionRequested = true;
  equal(
    buildDecisionReceipt(executionTamper).error.code,
    "invalid-decision-receipt-request",
    "Eylem yürütüldü iddiası reddedilmeli"
  );
  const auditTamper = clone(approvedRequest);
  auditTamper.auditPersisted = true;
  equal(
    buildDecisionReceipt(auditTamper).error.code,
    "invalid-decision-receipt-request",
    "Kalıcı audit iddiası reddedilmeli"
  );
  const transferTamper = clone(approvedRequest);
  transferTamper.externalTransfer = true;
  equal(
    buildDecisionReceipt(transferTamper).error.code,
    "invalid-decision-receipt-request",
    "Dış aktarım iddiası reddedilmeli"
  );
  const actionMismatch = clone(approvedRequest);
  actionMismatch.actionState.actionId = "action:other";
  equal(
    buildDecisionReceipt(actionMismatch).error.code,
    "invalid-decision-receipt-request",
    "Karar ve eylem kimliği uyuşmazlığı reddedilmeli"
  );
  const missingReplacement = clone(requestFrom(editedResult));
  missingReplacement.replacementAction = null;
  equal(
    buildDecisionReceipt(missingReplacement).error.code,
    "invalid-decision-receipt-request",
    "Düzenleme yeni onay-bekleyen taslak olmadan kabul edilmemeli"
  );
  const unexpectedReplacement = clone(approvedRequest);
  unexpectedReplacement.replacementAction = clone(
    editedResult.replacementAction
  );
  equal(
    buildDecisionReceipt(unexpectedReplacement).error.code,
    "invalid-decision-receipt-request",
    "Onay sonucu beklenmeyen yeni taslak taşıyamamalı"
  );
  const extraField = clone(approvedRequest);
  extraField.storageKey = "todayStore";
  equal(
    buildDecisionReceipt(extraField).error.code,
    "invalid-decision-receipt-request",
    "Makbuz sınırı bilinmeyen alanları reddetmeli"
  );
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf makbuz üreticisi DOM, depolama, ağ, Connect veya sistem saati kullanmamalı"
  );

  return checks;
}
