const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const moduleSource = fs.readFileSync('modules/nutrition-consumption-editor.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const swSource = fs.readFileSync('sw.js', 'utf8');
const versionSource = fs.readFileSync('modules/version.js', 'utf8');

assert.match(moduleSource, /TodayNutritionConsumptionEditor/);
assert.match(moduleSource, /addEventListener\("submit", submitEditedMeal, true\)/);
assert.match(moduleSource, /event\.stopImmediatePropagation\(\)/);
assert.match(moduleSource, /templateMultiplier = multiplier/);
assert.match(moduleSource, /amount:\s*\{[\s\S]*value: override\.value/);
assert.match(moduleSource, /MIN_AMOUNT = 0\.01/);
assert.match(moduleSource, /MAX_AMOUNT = 100000/);
assert.match(moduleSource, /window\.TodayNutritionEntry\.logMeal/);
assert.match(moduleSource, /window\.TodayNutritionUI\.refresh/);
assert.doesNotMatch(moduleSource, /localStorage|sessionStorage|fetch\(/);

assert.match(indexSource, /modules\/nutrition-ui\.js[\s\S]*modules\/nutrition-consumption-editor\.js[\s\S]*modules\/nutrition-library-ui\.js/);
assert.match(indexSource, /healthConsumptionEditor/);
assert.match(swSource, /today-v2-foundation-024/);
assert.match(swSource, /\.\/modules\/nutrition-consumption-editor\.js/);
assert.match(versionSource, /APP_VERSION = "2\.4\.1"/);

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
assert.equal(typeof context.window.TodayNutritionConsumptionEditor, 'object');
assert.equal(context.window.TodayNutritionConsumptionEditor.API_VERSION, 1);
assert.equal(context.window.TodayNutritionConsumptionEditor.RULESET_ID, 'today:nutrition:consumption-editor:v1');
assert.equal(listeners.some(([type]) => type === 'DOMContentLoaded'), true);

console.log('NUT-012 consumption editor acceptance: PASS');
