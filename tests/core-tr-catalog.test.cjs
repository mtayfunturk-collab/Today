'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { JSDOM } = require('jsdom');

(async () => {
  const root = path.resolve(__dirname, '..');
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  const catalog = JSON.parse(read('docs/T90-261101-PO1-I18N02-CORE-CATALOG.json'));
  const html = read('index.html');
  const lines = html.split(/\r?\n/);
  const { document } = new JSDOM(html).window;
  const { CORE_TR } = await import('../modules/locales/core-tr.mjs');
  const results = [];

  async function test(name, callback) {
    try {
      await callback();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  }

  await test('Catalog has 136 unique meaningful keys and nonempty Turkish copy', () => {
    assert.equal(catalog.schemaVersion, 1);
    assert.equal(catalog.entries.length, 136);
    assert.equal(new Set(catalog.entries.map(entry => entry.key)).size, 136);
    for (const entry of catalog.entries) {
      assert.match(entry.key, /^[a-z][a-zA-Z]*(?:\.[a-z][a-zA-Z]*)+$/);
      assert.equal(typeof entry.tr, 'string', entry.key);
      assert.ok(entry.tr.trim(), entry.key);
      assert.equal(entry.status, 'tr-source-verified');
      assert.deepEqual([...entry.parameters].sort(), [...new Set([...entry.tr.matchAll(/\{([A-Za-z]+)\}/g)].map(m => m[1]))].sort());
    }
  });

  await test('Catalog pins the current accumulated UI source, not the old Radio HTML', () => {
    assert.equal(catalog.sourceRef, 'b57dbceb53eb6a9aacc3bde709b4de096b77e38f');
    assert.equal(catalog.sourceSha256, createHash('sha256').update(html).digest('hex'));
    assert.notEqual(catalog.sourceSha256, '77e2283d83790441bc2b2b62fe08e08dc78abd4aaa781e931ad85fc19c6f6450');
  });

  await test('Every literal and all recorded raw source occurrences match the current file', () => {
    for (const entry of catalog.entries) {
      assert.ok(['index.html', 'modules/core-static-copy-ui.mjs', 'modules/startup-manager.js', 'modules/error-manager.js', 'modules/service-worker-manager.js'].includes(entry.source.file));
      assert.equal(entry.source.literal, entry.tr, entry.key);
      const occurrences = read(entry.source.file).split(/\r?\n/).flatMap((lineText, index) =>
        lineText.includes(entry.tr) ? [{ line: index + 1, lineText }] : []);
      assert.ok(occurrences.length, entry.key);
      assert.deepEqual(entry.source.occurrences, occurrences, entry.key);
    }
  });

  await test('Navigation copy matches the current grid control, hint and explicit Core return', () => {
    assert.equal(CORE_TR['core.openModules'], document.querySelector('#btnHomeFromPick').getAttribute('aria-label'));
    assert.equal(CORE_TR['core.modulesHint'], document.querySelector('#coreModulesHint').textContent);
    assert.equal(CORE_TR['modules.returnCore'], document.querySelector('#btnCoreFromModules').textContent);
    assert.equal(Object.hasOwn(CORE_TR, 'core.backModules'), false);
    assert.deepEqual(catalog.retiredKeys.map(item => [item.key, item.replacement]), [['core.backModules', 'core.openModules']]);
  });

  await test('All 12 stable palette IDs match title and accessible label, including mint/Nane', () => {
    const ids = ['navy', 'orange', 'red', 'blue', 'yellow', 'green', 'deep', 'pink', 'purple', 'teal', 'mint', 'gray'];
    const buttons = [...document.querySelectorAll('[data-view="pick"] .cbtn')];
    assert.deepEqual(buttons.map(button => button.dataset.color), ids);
    for (const button of buttons) {
      const key = 'color.' + button.dataset.color;
      assert.equal(CORE_TR[key], button.title, key);
      assert.equal(CORE_TR[key], button.getAttribute('aria-label'), key);
    }
    assert.equal(CORE_TR['color.mint'], 'Nane');
    assert.equal(Object.hasOwn(CORE_TR, 'color.coral'), false);
  });

  await test('Choice text maps to the original A/B/C controls without changing stored IDs', () => {
    const controls = [...document.querySelectorAll('#choices [data-choice]')];
    assert.deepEqual(controls.map(control => control.dataset.choice), ['A', 'B', 'C']);
    for (const control of controls) {
      const key = 'core.choice.' + control.dataset.choice.toLowerCase();
      assert.equal(CORE_TR[key + '.title'], control.querySelector('.ctitle').textContent);
      assert.equal(CORE_TR[key + '.description'], control.querySelector('.cdesc').textContent);
    }
  });

  await test('Note label, placeholder and truthful save failure copy remain source-aligned', () => {
    assert.equal(CORE_TR['core.note.label'], document.querySelector('label[for="note"]').textContent);
    assert.equal(CORE_TR['core.note.placeholder'], document.querySelector('#note').placeholder);
    assert.equal(CORE_TR['core.noteFailed'], 'Not kaydedilemedi. Taslak bu oturumda korunuyor.');
    assert.ok(html.includes('coreMessage("core.noteFailed", "' + CORE_TR['core.noteFailed'] + '")'));
  });

  await test('Prepared dictionary exactly covers the source catalog with plain Turkish strings', () => {
    assert.deepEqual(Object.keys(CORE_TR).sort(), catalog.entries.map(entry => entry.key).sort());
    for (const entry of catalog.entries) assert.equal(CORE_TR[entry.key], entry.tr, entry.key);
    assert.equal(catalog.dictionaryModule, 'modules/locales/core-tr.mjs');
  });

  await test('Dictionary cannot be changed or extended by a caller', () => {
    assert.equal(Object.isFrozen(CORE_TR), true);
    assert.throws(() => { CORE_TR['core.question'] = 'changed'; }, TypeError);
    assert.throws(() => { CORE_TR.extra = 'changed'; }, TypeError);
    assert.throws(() => { delete CORE_TR['core.question']; }, TypeError);
  });

  await test('Dictionary import does not touch DOM, device, storage, audio or network globals', async () => {
    const names = ['window', 'document', 'navigator', 'localStorage', 'indexedDB', 'fetch', 'Audio'];
    const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    try {
      for (const name of names) Object.defineProperty(globalThis, name, {
        configurable: true,
        get() { throw new Error('Unexpected access: ' + name); }
      });
      const isolated = await import('../modules/locales/core-tr.mjs?isolated-test');
      assert.deepEqual(isolated.CORE_TR, CORE_TR);
    } finally {
      for (const name of names) {
        const original = originals.get(name);
        if (original) Object.defineProperty(globalThis, name, original);
        else delete globalThis[name];
      }
    }
  });

  await test('English drafts do not become available translations or release readiness', async () => {
    const { AVAILABLE_LANGUAGES } = await import('../modules/language-resolver.mjs');
    assert.deepEqual(AVAILABLE_LANGUAGES, ['tr']);
    assert.equal(catalog.completeEnglishRelease, false);
    assert.equal(catalog.entries.filter(entry => entry.englishStatus === 'unreviewed-draft').length, 136);
    assert.equal(catalog.entries.filter(entry => entry.englishStatus === 'untranslated').length, 0);
    for (const entry of catalog.entries) {
      if (entry.englishStatus === 'untranslated') assert.equal(entry.en, null);
      else {
        assert.ok(typeof entry.en === 'string' && entry.en.trim(), entry.key);
        assert.deepEqual([...new Set([...entry.en.matchAll(/\{([A-Za-z]+)\}/g)].map(match => match[1]))].sort(), [...entry.parameters].sort(), entry.key);
      }
    }
    assert.equal(document.documentElement.lang, 'tr');
  });

  await test('Only the bounded copy adapter consumes the dictionary and the catalog stays design-only', () => {
    const modules = fs.readdirSync(path.join(root, 'modules'), { recursive: true })
      .map(name => path.join('modules', name))
      .filter(name => /\.(?:js|mjs)$/.test(name) && name !== path.join('modules', 'locales', 'core-tr.mjs'));
    for (const name of ['index.html', 'sw.js', ...modules]) {
      const source = read(name);
      assert.equal(/I18N02-CORE-CATALOG\.json/.test(source), false, name);
      if ([path.join('modules', 'core-static-copy.mjs'), path.join('modules', 'core-static-copy-ui.mjs')].includes(name)) {
        assert.ok(source.includes("import { CORE_TR } from './locales/core-tr.mjs'"));
      } else if (name === 'sw.js') {
        assert.equal((source.match(/"\.\/modules\/locales\/core-tr\.mjs"/g) || []).length, 1);
      } else {
        assert.equal(/core-tr\.mjs/.test(source), false, name);
      }
    }
  });

  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}: ${result.name}${result.error ? ' — ' + result.error : ''}`);
  const passed = results.filter(result => result.ok).length;
  console.log(`Core TR Catalog: ${passed}/${results.length} başarılı`);
  if (passed !== results.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
