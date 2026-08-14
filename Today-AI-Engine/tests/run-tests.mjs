import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runContextBuilderTests } from './context-builder.test.mjs';
import { runDailySupportAnalyzerTests } from './daily-support-analyzer.test.mjs';

const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const inputs = await load('../fixtures/synthetic/daily-context.json');
const output = await load('../fixtures/synthetic/expected-analysis.json');
const schemas = await Promise.all([
  load('../contracts/input-event.schema.json'),
  load('../contracts/analysis-output.schema.json'),
  load('../contracts/approval-decision.schema.json')
]);

assert.equal(schemas.length, 3, 'Üç sözleşme okunmalı');
assert.ok(inputs.every(x => x.schemaVersion === 1), 'Girdiler schemaVersion 1 olmalı');
assert.deepEqual(new Set(inputs.map(x => x.source)), new Set(['today-core', 'today-health']));
assert.equal(output.schemaVersion, 1);
assert.equal(output.requiresUserApproval, true);
assert.ok(output.uncertainty.length > 0, 'Belirsizlik görünür olmalı');
assert.ok(output.alternatives.length > 0, 'Kullanıcı alternatifi bulunmalı');
assert.ok(output.confidence >= 0 && output.confidence <= 1);

const ids = new Set(inputs.map(x => x.eventId));
assert.ok(output.evidence.every(x => ids.has(x.eventId)), 'Her kanıt gerçek bir girdi olayına bağlanmalı');
assert.ok(output.proposedActions.every(x => x.status === 'pending-user-approval'), 'Eylemler onay beklemeli');

const combined = JSON.stringify(output).toLocaleLowerCase('tr');
const forbidden = ['depresyondasın', 'teşhis', 'kesin olarak çatış', 'uyku bozukluğun var'];
assert.ok(forbidden.every(term => !combined.includes(term)), 'Yasaklı kesin/teşhis dili bulunmamalı');

const healthEvidence = output.evidence.filter(x => x.source === 'today-health');
const skyEvidence = output.evidence.filter(x => x.source === 'today-sky');
assert.ok(healthEvidence.length === 1 && skyEvidence.length === 0, 'Sağlık önerisi Sky kanıtına dayanmamalı');

console.log('10/10 sentetik sözleşme ve politika kontrolü başarılı.');

const nut017Checks = await runContextBuilderTests();
console.log(`${nut017Checks}/${nut017Checks} NUT-017.1 bağlam ve onay kontrolü başarılı.`);

const nut0173Checks = await runDailySupportAnalyzerTests();
console.log(`${nut0173Checks}/${nut0173Checks} NUT-017.3 açıklanabilir analiz kontrolü başarılı.`);
