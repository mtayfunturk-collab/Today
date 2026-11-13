'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

(async () => {
  const { applyCoreStaticCopy: apply, CORE_STATIC_BINDINGS: bindings, SHARED_STATIC_BINDINGS: shared, STATISTICS_STATIC_BINDINGS: statistics } = await import('../modules/core-static-copy.mjs');
  const { CORE_TR } = await import('../modules/locales/core-tr.mjs');
  const html = fs.readFileSync('index.html', 'utf8');
  const make = () => new JSDOM(html, { url: 'https://synthetic.invalid/' }).window.document;
  const results = [];
  async function test(name, callback) {
    try { await callback(); results.push({ name, ok: true }); }
    catch (error) { results.push({ name, ok: false, error: error.message }); }
  }
  await test('All 43 presentation targets are unique and resolve to one current HTML element', () => {
    const doc = make();
    assert.equal(bindings.length, 43);
    assert.equal(new Set(bindings.map(b => b.selector + '/' + b.field)).size, 43);
    for (const b of bindings) {
      assert.equal(doc.querySelectorAll(b.selector).length, 1, b.selector);
      assert.equal(typeof CORE_TR[b.key], 'string', b.key);
      assert.ok(['text', 'aria-label', 'title', 'placeholder'].includes(b.field));
    }
    assert.ok(Object.isFrozen(bindings) && bindings.every(Object.isFrozen));
  });
  await test('Existing HTML fallback exactly matches the bound Turkish dictionary', () => {
    const doc = make();
    for (const b of bindings) {
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Applying twice to matching fallback produces no DOM mutations', () => {
    const doc = make();
    const observer = new doc.defaultView.MutationObserver(() => {});
    observer.observe(doc, { subtree: true, attributes: true, childList: true, characterData: true });
    apply(doc); apply(doc);
    assert.deepEqual(observer.takeRecords(), []);
    observer.disconnect();
  });
  await test('Dictionary application updates every altered target through its intended field', () => {
    const doc = make();
    for (const b of bindings) {
      const node = doc.querySelector(b.selector);
      if (b.field === 'text') node.textContent = 'synthetic stale copy';
      else node.setAttribute(b.field, 'synthetic stale copy');
    }
    apply(doc);
    for (const b of bindings) {
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Textarea identity value selection focus and keyboard listener survive changed copy', () => {
    const doc = make();
    const note = doc.querySelector('#note');
    note.value = 'Sentetik taslak 🌸'; note.focus(); note.setSelectionRange(2, 6);
    let inputs = 0; note.addEventListener('input', () => { inputs += 1; });
    apply(doc, { ...CORE_TR, 'core.note.placeholder': 'Sentetik yeni yer tutucu' });
    assert.equal(doc.querySelector('#note'), note);
    assert.equal(note.value, 'Sentetik taslak 🌸');
    assert.equal(doc.activeElement, note);
    assert.deepEqual([note.selectionStart, note.selectionEnd], [2, 6]);
    note.dispatchEvent(new doc.defaultView.Event('input'));
    assert.equal(inputs, 1);
  });
  await test('Grid and calendar icons keep their existing node identities', () => {
    const doc = make();
    const grid = doc.querySelector('#btnHomeFromPick svg');
    const calendar = doc.querySelector('#btnCalendar span');
    apply(doc, { ...CORE_TR, 'core.openModules': 'Sentetik modüller', 'core.openCalendar': 'Sentetik takvim' });
    assert.equal(doc.querySelector('#btnHomeFromPick svg'), grid);
    assert.equal(doc.querySelector('#btnCalendar span'), calendar);
  });
  await test('A future nested icon or input in a text target is never erased', () => {
    const doc = make();
    const label = doc.querySelector('label[for="note"]');
    const input = doc.createElement('input'); label.append(input);
    const before = label.innerHTML;
    apply(doc, { ...CORE_TR, 'core.note.label': 'Changed label' });
    assert.equal(label.innerHTML, before);
    assert.equal(label.querySelector('input'), input);
  });
  await test('Modules Health Sky Radio AI and live date/status output stay untouched', () => {
    const doc = make();
    const selectors = ['[data-view="modules"]', '[data-view="health"]', '[data-view="sky"]', '[data-view="radio"]', '[data-view="calendar"]', '#pillDate', '#statusPick', '#statusHome', '#buildTag'];
    for (const selector of ['#statusPick', '#statusHome', '#pillDate']) doc.querySelector(selector).textContent = 'Sentetik dinamik çıktı';
    const before = selectors.map(selector => doc.querySelector(selector).outerHTML);
    apply(doc, { ...CORE_TR, 'core.question': 'Sentetik farklı soru' });
    assert.deepEqual(selectors.map(selector => doc.querySelector(selector).outerHTML), before);
  });
  await test('Existing action listeners choice/color IDs and accessibility references stay intact', () => {
    const doc = make(); let clicks = 0;
    const start = doc.querySelector('#btnStart'); start.addEventListener('click', () => { clicks += 1; });
    const before = [...doc.querySelectorAll('[data-choice],[data-color],[aria-labelledby],[aria-describedby]')]
      .map(n => [n, n.dataset.choice, n.dataset.color, n.getAttribute('aria-labelledby'), n.getAttribute('aria-describedby')]);
    apply(doc, { ...CORE_TR, 'home.start': 'Sentetik başla' }); start.click();
    assert.equal(clicks, 1);
    for (const [n, choice, color, labelled, described] of before) {
      assert.equal(n.dataset.choice, choice); assert.equal(n.dataset.color, color);
      assert.equal(n.getAttribute('aria-labelledby'), labelled); assert.equal(n.getAttribute('aria-describedby'), described);
    }
  });
  await test('Missing empty invalid and inherited dictionary keys preserve HTML fallback', () => {
    for (const copy of [null, {}, { 'home.start': '' }, { 'home.start': '  ' }, { 'home.start': false }, Object.create({ 'home.start': 'inherited' })]) {
      const doc = make(); const before = doc.documentElement.outerHTML; apply(doc, copy);
      assert.equal(doc.documentElement.outerHTML, before);
    }
  });
  await test('Markup in copy is rendered as text and cannot create elements or handlers', () => {
    const doc = make(); const markup = '<img src=x onerror="alert(1)">';
    apply(doc, { 'core.question': markup, 'core.openModules': markup });
    assert.equal(doc.querySelector('#pickTitle').textContent, markup);
    assert.equal(doc.querySelector('#pickTitle img'), null);
    assert.equal(doc.querySelector('#btnHomeFromPick').getAttribute('aria-label'), markup);
    assert.equal(doc.querySelector('#btnHomeFromPick').hasAttribute('onerror'), false);
  });
  await test('Absent optional surface is tolerated without creating DOM or storage', () => {
    const doc = new JSDOM('<html lang="tr"><body><main>Unrelated surface</main></body></html>').window.document;
    const before = doc.documentElement.outerHTML; apply(doc);
    assert.equal(doc.documentElement.outerHTML, before);
  });
  await test('Import and explicit application do not read device storage network or audio globals', async () => {
    const doc = make();
    const names = ['document', 'window', 'navigator', 'localStorage', 'indexedDB', 'fetch', 'Audio'];
    const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    try {
      for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('Unexpected ' + name); } });
      const isolated = await import('../modules/core-static-copy.mjs?isolated-test'); isolated.applyCoreStaticCopy(doc);
      assert.equal(doc.documentElement.lang, 'tr');
    } finally {
      for (const name of names) {
        const original = originals.get(name);
        if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name];
      }
    }
  });
  await test('Deferred entry and its full three-file dependency closure are in the offline shell', () => {
    const sw = fs.readFileSync('sw.js', 'utf8');
    for (const file of ['core-static-copy-ui.mjs', 'core-static-copy.mjs', 'date-presentation.mjs', 'locales/core-tr.mjs']) assert.ok(sw.includes(`"./modules/${file}"`), file);
    assert.equal((html.match(/<script type="module" src="\.\/modules\/core-static-copy-ui\.mjs"><\/script>/g) || []).length, 1);
    assert.ok(sw.includes('today-v2-foundation-101'));
  });
  await test('All 25 shared targets resolve once and match normalized HTML fallback', () => {
    const doc = make();
    assert.equal(shared.length, 25);
    assert.equal(new Set([...bindings, ...shared].map(b => b.selector + '/' + b.field)).size, 68);
    assert.ok(Object.isFrozen(shared) && shared.every(Object.isFrozen));
    for (const b of shared) {
      assert.equal(doc.querySelectorAll(b.selector).length, 1, b.selector);
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent.trim() : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Shared dictionary copy actually replaces every altered target', () => {
    const doc = make();
    for (const b of shared) {
      const node = doc.querySelector(b.selector);
      if (b.field === 'text') node.textContent = 'synthetic stale copy';
      else node.setAttribute(b.field, 'synthetic stale copy');
    }
    apply(doc);
    for (const b of shared) {
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Changing option text preserves every theme value selection focus and change listener', () => {
    for (const value of ['system', 'light', 'dark', 'contrast']) {
      const doc = make(); const select = doc.querySelector('#themeSelect');
      select.value = value; select.focus(); let changes = 0;
      select.addEventListener('change', () => { changes += 1; });
      const options = [...select.options];
      const copy = { ...CORE_TR, ...Object.fromEntries(options.map(option => ['theme.' + option.value, 'Sentetik ' + option.value])) };
      apply(doc, copy);
      assert.equal(select.value, value); assert.equal(doc.activeElement, select);
      assert.deepEqual([...select.options], options);
      assert.deepEqual(options.map(option => option.value), ['system', 'light', 'dark', 'contrast']);
      assert.equal(changes, 0);
      select.dispatchEvent(new doc.defaultView.Event('change')); assert.equal(changes, 1);
    }
  });
  await test('Module cards accordion icons and accessibility state retain existing nodes and actions', () => {
    const doc = make();
    const selectors = ['#btnModuleCore', '#btnModuleHealth', '#btnModuleSky', '#btnModuleRadio', '#accSettingsHead', '#accStatsHead'];
    const nodes = selectors.map(selector => doc.querySelector(selector));
    const states = nodes.map(node => [node.getAttribute('aria-expanded'), node.getAttribute('aria-controls'), node.dataset.module]);
    const icons = [...doc.querySelectorAll('.moduleIcon, #accSettingsHead .mini, #accStatsArrow')];
    let clicks = 0; nodes.forEach(node => node.addEventListener('click', () => { clicks += 1; }));
    apply(doc, { ...CORE_TR, 'modules.radio.title': 'Sentetik Radyo', 'settings.title': 'Sentetik Ayarlar' });
    assert.deepEqual(selectors.map(selector => doc.querySelector(selector)), nodes);
    assert.deepEqual(nodes.map(node => [node.getAttribute('aria-expanded'), node.getAttribute('aria-controls'), node.dataset.module]), states);
    assert.deepEqual([...doc.querySelectorAll('.moduleIcon, #accSettingsHead .mini, #accStatsArrow')], icons);
    nodes.forEach(node => node.click()); assert.equal(clicks, nodes.length);
  });
  await test('Updating shared headings never changes dynamic calendar chart AI or Radio player content', () => {
    const doc = make();
    doc.querySelector('#moduleHealthDesc').textContent = 'Beslenme, spor ve yaşam';
    const mini = doc.createElement('div'); mini.className = 'radioMini'; mini.textContent = 'Sentetik canlı istasyon';
    doc.querySelector('.radioModule').append(mini);
    const selectors = ['#moduleHealthDesc', '#calPill', '#monthTitle', '#calGrid', '#chartLabel', '#chartSummary', '#summaryText', '#aiContextPanel', '#statusModules', '.radioMini'];
    const nodes = selectors.map(selector => doc.querySelector(selector));
    const before = nodes.map(node => node.outerHTML);
    apply(doc, { ...CORE_TR, ...Object.fromEntries(shared.map(b => [b.key, 'Sentetik ' + b.key])) });
    assert.deepEqual(selectors.map(selector => doc.querySelector(selector)), nodes);
    assert.deepEqual(nodes.map(node => node.outerHTML), before);
  });
  await test('Invalid shared dictionary entries preserve original indented text and attributes', () => {
    for (const value of [undefined, null, false, '', '  ']) {
      const doc = make(); const before = doc.documentElement.outerHTML;
      apply(doc, Object.fromEntries(shared.map(b => [b.key, value])));
      assert.equal(doc.documentElement.outerHTML, before);
    }
  });
  await test('Untrusted shared labels stay plain text and cannot add markup to a Radio card', () => {
    const doc = make(); const markup = '<audio autoplay src="https://synthetic.invalid/no-stream"></audio>';
    apply(doc, { 'modules.radio.title': markup, 'settings.title': markup });
    assert.equal(doc.querySelector('#btnModuleRadio strong').textContent, markup);
    assert.equal(doc.querySelector('#btnModuleRadio').getAttribute('aria-label'), markup);
    assert.equal(doc.querySelector('#accSettingsHead > span').textContent, markup);
    assert.equal(doc.querySelector('audio'), null);
  });
  await test('All 14 statistics targets uniquely match the current HTML and Turkish dictionary', () => {
    const doc = make();
    assert.equal(statistics.length, 14);
    assert.equal(new Set([...bindings, ...shared, ...statistics].map(b => b.selector + '/' + b.field)).size, 82);
    assert.ok(Object.isFrozen(statistics) && statistics.every(Object.isFrozen));
    for (const b of statistics) {
      assert.equal(doc.querySelectorAll(b.selector).length, 1, b.selector);
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent.trim() : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Every statistics target can be repaired without rebuilding the panel', () => {
    const doc = make(); const panel = doc.querySelector('#accStatsBody');
    for (const b of statistics) {
      const node = doc.querySelector(b.selector);
      if (b.field === 'text') node.textContent = 'synthetic stale copy';
      else node.setAttribute(b.field, 'synthetic stale copy');
    }
    apply(doc);
    assert.equal(doc.querySelector('#accStatsBody'), panel);
    for (const b of statistics) {
      const node = doc.querySelector(b.selector);
      assert.equal(b.field === 'text' ? node.textContent : node.getAttribute(b.field), CORE_TR[b.key], b.key);
    }
  });
  await test('Statistics copy preserves mode IDs pressed state focus icons and click handlers', () => {
    const doc = make(); const modes = [...doc.querySelectorAll('#accStatsBody [data-mode]')];
    const before = modes.map(node => [node, node.dataset.mode, node.getAttribute('aria-pressed'), node.textContent]);
    let clicks = 0; modes.forEach(node => node.addEventListener('click', () => { clicks += 1; }));
    modes[2].focus();
    apply(doc, { ...CORE_TR, ...Object.fromEntries(statistics.map(b => [b.key, 'Sentetik ' + b.key])) });
    assert.equal(doc.activeElement, modes[2]);
    assert.deepEqual([...doc.querySelectorAll('#accStatsBody [data-mode]')].map(node => [node, node.dataset.mode, node.getAttribute('aria-pressed'), node.textContent]), before);
    assert.equal(clicks, 0); modes.forEach(node => node.click()); assert.equal(clicks, 4);
  });
  await test('Static statistics copy never overwrites the renderer-owned chart or dynamic summary', () => {
    const doc = make();
    doc.querySelector('#chartLabel').textContent = 'Sentetik gün grafiği';
    doc.querySelector('#chartSummary').textContent = 'Sentetik toplam: 3';
    doc.querySelector('#summaryText').textContent = 'Sentetik kişisel özet';
    doc.querySelector('#line').setAttribute('d', 'M0 0L1 1');
    const selectors = ['#chartLabel', '#chartSummary', '#summaryText', '#chart', '#monthTitle', '#calGrid', '#aiContextPanel'];
    const nodes = selectors.map(selector => doc.querySelector(selector));
    const before = nodes.map(node => node.outerHTML);
    apply(doc, { ...CORE_TR, ...Object.fromEntries(statistics.map(b => [b.key, 'Sentetik ' + b.key])) });
    assert.deepEqual(selectors.map(selector => doc.querySelector(selector)), nodes);
    assert.deepEqual(nodes.map(node => node.outerHTML), before);
  });
  await test('Updating export clear-log and summary labels neither executes actions nor erases the arrow', () => {
    const doc = make(); const arrow = doc.querySelector('#accSummaryHead .mini');
    let actions = 0;
    for (const selector of ['#btnExport', '#btnClearTodayLogs', '#accSummaryHead']) doc.querySelector(selector).addEventListener('click', () => { actions += 1; });
    const before = doc.querySelector('#accSummaryHead').getAttribute('aria-expanded');
    apply(doc, { 'statistics.export': 'Sentetik dışa aktar', 'statistics.clearTodayLogs': 'Sentetik temizle', 'statistics.summary': 'Sentetik özet' });
    assert.equal(actions, 0); assert.equal(doc.querySelector('#accSummaryHead .mini'), arrow);
    assert.equal(doc.querySelector('#accSummaryHead').getAttribute('aria-expanded'), before);
  });
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}: ${r.name}${r.error ? ' — ' + r.error : ''}`);
  const passed = results.filter(r => r.ok).length;
  console.log(`Core Static Copy: ${passed}/${results.length} başarılı`);
  if (passed !== results.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
