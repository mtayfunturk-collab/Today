import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getStatus,
  recordApprovalDecision
} from "../modules/ai-approval-bridge.mjs";

const bridgeSource = await readFile(
  new URL("../modules/ai-approval-bridge.mjs", import.meta.url),
  "utf8"
);

function options(overrides = {}) {
  return {
    decisionId: "decision:nut-017.4:bridge-001",
    analysisId: "analysis:nut-017.3.1:bridge-001",
    action: {
      actionId: "action:analysis:nut-017.3.1:bridge-001:sleep-preparation",
      type: "create-reminder",
      label: "Uyku hazırlığını hatırla",
      status: "pending-user-approval"
    },
    decision: "approved",
    decidedAt: "2040-01-16T12:05:00.000Z",
    ...overrides
  };
}

const results = [];
async function test(name, callback) {
  try {
    await callback();
    results.push({ name, success: true });
  } catch (error) {
    results.push({ name, success: false, error });
  }
}

await test("Köprü cihaz-içi, geçici, makbuzlu ve yürütmesiz durum bildirir", () => {
  const status = getStatus();
  assert.equal(status.ready, true);
  assert.equal(status.engineVersion, "0.5.0-receipt");
  assert.equal(status.approvalEngineVersion, "0.4.0-approval");
  assert.equal(status.rulesetId, "today:ai-approval-bridge:nut-017.5");
  assert.equal(status.processingMode, "device-only");
  assert.equal(status.retention, "request-scoped");
  assert.equal(status.externalRecipient, null);
  assert.equal(status.connectEnabled, false);
  assert.equal(status.executionEnabled, false);
  assert.equal(status.decisionReceiptEnabled, true);
  assert.equal(status.auditPersistenceEnabled, false);
  assert.equal(Object.isFrozen(status), true);
});

await test("Geçerli onay mevcut karar sözleşmesiyle kayda dönüşür", () => {
  const result = recordApprovalDecision(options());
  assert.equal(result.success, true);
  assert.equal(result.decision.schemaVersion, 1);
  assert.equal(result.decision.decision, "approved");
  assert.equal(result.actionState.status, "approved");
  assert.equal(result.receipt.eventType, "user-decision-recorded");
  assert.equal(result.receipt.outcome, "approved");
  assert.equal(result.receipt.decisionId, result.decision.decisionId);
});

await test("Ret hiçbir eylem başlatmadan sonuçlanır", () => {
  const result = recordApprovalDecision(options({
    decisionId: "decision:nut-017.4:bridge-002",
    decision: "rejected"
  }));
  assert.equal(result.success, true);
  assert.equal(result.actionState.status, "rejected");
  assert.equal(result.executionRequested, false);
  assert.equal(result.receipt.outcome, "rejected");
});

await test("Düzenleme yeni ve yeniden onay bekleyen taslak üretir", () => {
  const result = recordApprovalDecision(options({
    decisionId: "decision:nut-017.4:bridge-003",
    decision: "edited",
    editedPayload: { reminderTime: "21:45" }
  }));
  assert.equal(result.success, true);
  assert.equal(result.decision.decision, "edited");
  assert.equal(result.replacementAction.status, "pending-user-approval");
  assert.match(result.replacementAction.label, /21:45/);
  assert.equal(result.receipt.outcome, "edited");
  assert.equal(result.receipt.effects.replacementRequiresApproval, true);
  assert.equal(
    result.receipt.replacementActionId,
    result.replacementAction.actionId
  );
});

await test("Geçersiz karar fail-closed reddedilir", () => {
  const result = recordApprovalDecision(options({ decision: "bypass" }));
  assert.deepEqual({ ...result }, {
    success: false,
    errorCode: "TODAY-AI-APPROVAL-DECISION",
    decisionError: "invalid-approval-decision"
  });
});

await test("Köprü kararı kalıcılaştırmaz, aktarmıyor ve yürütmüyor", () => {
  const result = recordApprovalDecision(options());
  assert.equal(result.processing.mode, "device-only");
  assert.equal(result.processing.retention, "request-scoped");
  assert.equal(result.auditPersisted, false);
  assert.equal(result.externalTransfer, false);
  assert.equal(result.executionRequested, false);
  assert.equal(result.receipt.scope.persistent, false);
  assert.equal(result.receipt.scope.retention, "request-scoped");
  assert.equal(result.receipt.effects.auditPersisted, false);
  assert.equal(result.receipt.effects.connectCalled, false);
});

await test("Makbuz yalnız karar zamanını kullanır ve sonucu değiştirmez", () => {
  const input = options();
  const result = recordApprovalDecision(input);
  assert.equal(result.receipt.occurredAt, input.decidedAt);
  assert.equal(result.receipt.actionId, input.action.actionId);
  assert.equal(result.receipt.actionStatus, "approved");
  assert.equal(Object.isFrozen(result.receipt), true);
});

await test("Karar köprüsü DOM, storage, ağ, TodayAI veya Connect çağırmaz", () => {
  assert.doesNotMatch(
    bridgeSource,
    /(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayAI\s*\.|requestProposal\s*\(|TodayConnect\s*\.)/
  );
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.5 Approval & Receipt Bridge: ${passed}/${results.length} başarılı`);
