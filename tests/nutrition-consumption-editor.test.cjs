const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

let checks = 0;
function check(callback) {
  callback();
  checks += 1;
}

const moduleSource = fs.readFileSync('modules/nutrition-consumption-editor.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');
const versionSource = fs.readFileSync('modules/version.js', 'utf8');

check(() => assert.match(moduleSource, /TodayNutritionConsumptionEditor/));
check(() => assert.match(moduleSource, /addEventListener\("submit", submitEditedMeal, true\)/));
check(() => assert.match(moduleSource, /event\.stopImmediatePropagation\(\)/));
check(() => assert.match(moduleSource, /templateMultiplier = multiplier/));
check(() => assert.match(moduleSource, /amount:\s*\{[\s\S]*value: override\.value/));
check(() => assert.match(moduleSource, /MIN_AMOUNT = 0\.01/));
check(() => assert.match(moduleSource, /MAX_AMOUNT = 100000/));
check(() => assert.match(moduleSource, /window\.TodayNutritionEntry\.logMeal/));
check(() => assert.match(moduleSource, /window\.TodayNutritionUI\.refresh/));
check(() => assert.doesNotMatch(moduleSource, /localStorage|sessionStorage|fetch\(/));

check(() => assert.match(indexSource, /modules\/nutrition-ui\.js[\s\S]*modules\/nutrition-consumption-editor\.js[\s\S]*modules\/nutrition-library-ui\.js/));
check(() => assert.match(indexSource, /healthConsumptionEditor/));
check(() => assert.match(swSource, /const VERSION = "today-v2-foundation-\d+"/));
check(() => assert.match(swSource, /\.\/modules\/nutrition-consumption-editor\.js/));
check(() => assert.match(versionSource, /const APP_VERSION = "\d+\.\d+\.\d+"/));

const listeners = [];
const fakeDocument = {
  readyState: 'loading',
  addEventListener(type, handler) { listeners.push([type, handler]); },
  getElementById() { return null; }
};
const context = {
  window: { setInterval() { return 1; }, clearInterval() {} },
  document: fakeDocument,
  MutationObserver: class {},
  structuredClone: value => JSON.parse(JSON.stringify(value)),
  console
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(moduleSource, context);
check(() => assert.equal(typeof context.window.TodayNutritionConsumptionEditor, 'object'));
check(() => assert.equal(context.window.TodayNutritionConsumptionEditor.API_VERSION, 1));
check(() => assert.equal(context.window.TodayNutritionConsumptionEditor.RULESET_ID, 'today:nutrition:consumption-editor:v1'));
check(() => assert.equal(listeners.some(([type]) => type === 'DOMContentLoaded'), true));

async function createRuntime({ type = 'food_version', today = true, logMeal } = {}) {
  const dom = new JSDOM(`<!doctype html><form id="healthMealForm">
    <input id="healthMealType" value="lunch"><input id="healthMealName">
    <ul id="healthLibrarySelected"><li><button type="button"
      data-remove-nutrition-library="fixture-item">Kaldır</button></li></ul>
    <button id="btnHealthMealSubmit" type="submit">Kaydet</button>
    </form><div id="healthStatus"></div>`, {
    runScripts: 'outside-only', url: 'https://today.test/'
  });
  const { window } = dom;
  window.localStorage.setItem('protected-fixture', 'existing-user-data');
  const selected = [{
    recordId: 'fixture-item', type, name: 'Sentetik öğe',
    amount: { status: 'known', value: 100, unit: 'g', basis: null }
  }];
  const sourceSnapshot = JSON.stringify(selected);
  const calls = [];
  let refreshes = 0;
  let baseSubmissions = 0;
  // Model the existing NutritionUI submit handler beneath the editor's capture listener.
  window.document.getElementById('healthMealForm').addEventListener('submit', () => {
    baseSubmissions += 1;
  });
  window.TodayNutritionUI = {
    getState: () => ({ library: { selected } }),
    selectedIsToday: () => today,
    refresh: async () => { refreshes += 1; }
  };
  window.TodayNutritionEntry = {
    logMeal: async (input, confirmation) => {
      calls.push({ input, confirmation });
      if (logMeal) await logMeal(input, confirmation);
    }
  };
  window.document.querySelector('[data-remove-nutrition-library]')
    .addEventListener('click', () => { selected.length = 0; });
  new vm.Script(moduleSource).runInContext(dom.getInternalVMContext());
  if (window.document.readyState === 'loading') {
    await new Promise(resolve => window.document.addEventListener(
      'DOMContentLoaded', resolve, { once: true }
    ));
  }
  return {
    window, selected, sourceSnapshot, calls,
    get refreshes() { return refreshes; },
    get baseSubmissions() { return baseSubmissions; },
    edit(value) {
      const input = window.document.querySelector('[data-nutrition-amount-record-id]');
      input.value = String(value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    submit() {
      window.document.getElementById('healthMealForm').dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      );
    },
    async settled() {
      // The stubbed write/refresh promises resolve through the microtask queue.
      for (let index = 0; index < 6; index += 1) await Promise.resolve();
    },
    close() { window.close(); }
  };
}

let failed = 0;
async function runtimeCheck(name, callback, options) {
  const runtime = await createRuntime(options);
  try {
    await callback(runtime);
    checks += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name} — ${error.message}`);
  } finally {
    runtime.close();
  }
}

async function run() {
  await runtimeCheck('Başlatma mevcut localStorage ve kaynak seçimini değiştirmiyor', r => {
    assert.equal(r.window.TodayNutritionConsumptionEditor.getState().initialized, true);
    assert.equal(r.window.localStorage.length, 1);
    assert.equal(r.window.localStorage.getItem('protected-fixture'), 'existing-user-data');
    assert.equal(JSON.stringify(r.selected), r.sourceSnapshot);
    assert.equal(r.calls.length, 0);
  });

  await runtimeCheck('Düzenlenen miktar birimi ve kaynak kaydı korunarak kaydediliyor', async r => {
    r.edit(150);
    assert.equal(JSON.stringify(r.selected), r.sourceSnapshot);
    r.submit();
    await r.settled();
    assert.equal(r.calls.length, 1);
    assert.equal(r.baseSubmissions, 0);
    assert.equal(r.calls[0].input.items[0].amount.value, 150);
    assert.equal(r.calls[0].input.items[0].amount.unit, 'g');
    assert.equal(r.calls[0].confirmation.userConfirmed, true);
    assert.equal(r.refreshes, 1);
  });

  await runtimeCheck('Öğün şablonuna tüketim çarpanı uygulanıyor', async r => {
    r.edit(2);
    r.submit();
    await r.settled();
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].input.templateId, 'fixture-item');
    assert.equal(r.calls[0].input.templateMultiplier, 2);
  }, { type: 'meal_template' });

  await runtimeCheck('Sıfır miktar yazılmadan reddediliyor', async r => {
    r.edit(0);
    r.submit();
    await r.settled();
    assert.equal(r.calls.length, 0);
    assert.equal(r.window.document.getElementById('healthStatus').dataset.kind, 'error');
    assert.equal(r.window.document.querySelector('input[aria-invalid="true"]').value, '0');
    assert.equal(JSON.stringify(r.selected), r.sourceSnapshot);
  });

  await runtimeCheck('Geçmiş güne tüketim yazılamıyor', async r => {
    r.submit();
    await r.settled();
    assert.equal(r.calls.length, 0);
    assert.equal(JSON.stringify(r.selected), r.sourceSnapshot);
  }, { today: false });

  let finishWrite;
  await runtimeCheck('Bekleyen kayıtta yinelenen gönderim tek yazma üretiyor', async r => {
    r.submit();
    r.submit();
    assert.equal(r.calls.length, 1);
    assert.equal(r.baseSubmissions, 0);
    assert.equal(r.window.TodayNutritionConsumptionEditor.getState().submitting, true);
    finishWrite();
    await r.settled();
    assert.equal(r.window.TodayNutritionConsumptionEditor.getState().submitting, false);
  }, { logMeal: () => new Promise(resolve => { finishWrite = resolve; }) });

  await runtimeCheck('Yazma hatası seçimi koruyor ve formu yeniden kullanılabilir bırakıyor', async r => {
    r.edit(125);
    r.submit();
    await r.settled();
    assert.equal(JSON.stringify(r.selected), r.sourceSnapshot);
    assert.equal(r.window.document.getElementById('healthStatus').dataset.kind, 'error');
    assert.equal(r.window.document.getElementById('btnHealthMealSubmit').disabled, false);
    assert.equal(r.window.TodayNutritionConsumptionEditor.getState().submitting, false);
    assert.equal(r.window.document.querySelector('[data-nutrition-amount-record-id]').value, '125');
  }, { logMeal: async () => { throw new Error('Sentetik yazma hatası'); } });

  await runtimeCheck('Yinelenen init çift olay dinleyicisi oluşturmuyor', async r => {
    r.window.TodayNutritionConsumptionEditor.init();
    r.window.TodayNutritionConsumptionEditor.init();
    r.submit();
    await r.settled();
    assert.equal(r.calls.length, 1);
    assert.equal(r.window.document.querySelectorAll('[data-nutrition-consumption-editor]').length, 1);
  });

  console.log(`NUT-012 Consumption Editor: ${checks}/${checks + failed} başarılı`);
  if (failed) process.exitCode = 1;
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
