import { CORE_TR } from './locales/core-tr.mjs';

// Explicit presentation targets: no input values, IDs, state or live statuses.
const targets = [
  ['#homeTitle', 'home.title', 'text'],
  ['[data-view="home"] .sub', 'home.privacy', 'text'],
  ['#btnStart', 'home.start', 'text'],
  ['#btnHomeFromPick', 'core.openModules', 'aria-label'],
  ['#coreModulesHint', 'core.modulesHint', 'text'],
  ['#btnCalendar', 'core.openCalendar', 'aria-label'],
  ['#pickTitle', 'core.question', 'text'],
  ...['a', 'b', 'c'].flatMap(choice => [
    [`#choice${choice.toUpperCase()}Title`, `core.choice.${choice}.title`, 'text'],
    [`#choice${choice.toUpperCase()}Desc`, `core.choice.${choice}.description`, 'text']
  ]),
  ['[data-view="pick"] .colors', 'core.colors.label', 'aria-label'],
  ['[data-view="pick"] .colors + .mini', 'core.colors.optional', 'text'],
  ['[data-view="pick"] label[for="note"]', 'core.note.label', 'text'],
  ['#note', 'core.note.placeholder', 'placeholder'],
  ['#btnResetToday', 'core.resetToday', 'text'],
  ['[data-view="pick"] .bottomNav', 'navigation.label', 'aria-label'],
  ...['navy', 'orange', 'red', 'blue', 'yellow', 'green', 'deep', 'pink', 'purple', 'teal', 'mint', 'gray']
    .flatMap(color => ['title', 'aria-label'].map(field => [
      `[data-view="pick"] [data-color="${color}"]`, `color.${color}`, field
    ]))
];

export const CORE_STATIC_BINDINGS = Object.freeze(targets.map(([selector, key, field]) =>
  Object.freeze({ selector, key, field })));

// Shared static controls only. Dates, charts, live statuses and AI stay with their renderers.
const sharedTargets = [
  ['#modulesTitle', 'home.title', 'text'],
  ['#btnCoreFromModules', 'modules.returnCore', 'text'],
  ['[data-view="modules"] .moduleCards', 'modules.label', 'aria-label'],
  ...['core', 'health', 'sky'].flatMap(name => {
    const id = name[0].toUpperCase() + name.slice(1);
    const entries = [[`#module${id}Title`, `modules.${name}.title`, 'text']];
    // HealthHub owns its description after startup; retain that dynamic output.
    if (name !== 'health') entries.push([`#module${id}Desc`, `modules.${name}.description`, 'text']);
    return entries;
  }),
  ['#btnModuleRadio', 'modules.radio.title', 'aria-label'],
  ['#btnModuleRadio strong', 'modules.radio.title', 'text'],
  ['#btnModuleRadio small', 'modules.radio.description', 'text'],
  ['#btnBackToPick', 'calendar.backCore', 'aria-label'],
  ['#btnStats', 'calendar.openStatistics', 'aria-label'],
  ['#calHint', 'calendar.currentMonth', 'text'],
  ['#btnOpenStats', 'statistics.title', 'text'],
  ['#btnOpenSettings', 'settings.title', 'text'],
  ['#accStatsHead > span:not(.mini)', 'statistics.title', 'text'],
  ['#accSettingsHead > span:not(.mini)', 'settings.title', 'text'],
  ['label[for="themeSelect"]', 'settings.theme', 'text'],
  ['#btnBackupLaunch', 'backup.launch', 'text'],
  ...['system', 'light', 'dark', 'contrast'].map(theme => [
    `#themeSelect option[value="${theme}"]`, `theme.${theme}`, 'text'
  ]),
  ['#accSettingsBody > .mini', 'settings.storage', 'text']
];

export const SHARED_STATIC_BINDINGS = Object.freeze(sharedTargets.map(([selector, key, field]) =>
  Object.freeze({ selector, key, field })));
const statisticsTargets = [
  ['#chartMini', 'statistics.chartHint', 'text'],
  ['#accStatsBody .modeRow', 'statistics.range', 'aria-label'],
  ...['hour', 'day', 'week', 'month'].flatMap(mode => [
    [`#accStatsBody [data-mode="${mode}"]`, `statistics.mode.${mode}.title`, 'title'],
    [`#accStatsBody [data-mode="${mode}"]`, `statistics.${mode}.aria`, 'aria-label']
  ]),
  ['#accSummaryHead > span:not(.mini)', 'statistics.summary', 'text'],
  ['#btnExport', 'statistics.export', 'text'],
  ['#btnClearTodayLogs', 'statistics.clearTodayLogs', 'text'],
  ['#accStatsBody > .mini', 'statistics.logsNotice', 'text']
];

export const STATISTICS_STATIC_BINDINGS = Object.freeze(statisticsTargets.map(([selector, key, field]) =>
  Object.freeze({ selector, key, field })));
const allBindings = [...CORE_STATIC_BINDINGS, ...SHARED_STATIC_BINDINGS, ...STATISTICS_STATIC_BINDINGS];

/** Apply prepared TR copy to existing leaf text/attributes; retain HTML fallback. */
export function applyCoreStaticCopy(root, copy = CORE_TR) {
  for (const { selector, key, field } of allBindings) {
    if (!copy || !Object.hasOwn(copy, key)) continue;
    const text = copy[key];
    if (typeof text !== 'string' || !text.trim()) continue;
    for (const element of root.querySelectorAll(selector)) {
      if (field === 'text') {
        // Never erase a future icon, input or other nested control.
        if (element.childElementCount === 0 && element.textContent !== text && element.textContent.trim() !== text) element.textContent = text;
      } else if (element.getAttribute(field) !== text) {
        element.setAttribute(field, text);
      }
    }
  }
}
