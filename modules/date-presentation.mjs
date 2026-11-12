/** Pure date presentation. No key parsing, timezone conversion or language activation. */
const DATE_LOCALES = Object.freeze({ tr: 'tr-TR', en: 'en-US' });
const DATE_STYLES = Object.freeze({
  core: Object.freeze({ day: '2-digit', month: 'long', year: 'numeric' }),
  month: Object.freeze({ month: 'long', year: 'numeric' }),
  day: Object.freeze({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
});

// English is an explicit formatter capability, not an available application language.
export function formatDatePresentation(date, kind, language = 'tr') {
  if (!Object.hasOwn(DATE_STYLES, kind)) throw new TypeError('Unknown calendar format');
  if (!Object.hasOwn(DATE_LOCALES, language)) throw new TypeError('Unknown date presentation language');
  return Date.prototype.toLocaleDateString.call(date, DATE_LOCALES[language], DATE_STYLES[kind]);
}
