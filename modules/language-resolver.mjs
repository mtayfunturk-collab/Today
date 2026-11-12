/**
 * Pure UI-language selection. No browser adapter, persistence or UI activation.
 * Turkish is the mandatory built-in fallback. English readiness may only be
 * supplied explicitly by a future, separately validated integration.
 */
export const AVAILABLE_LANGUAGES = Object.freeze(['tr']);
const SUPPORTED = Object.freeze(['tr', 'en']);
const MAX_DEVICE_LANGUAGES = 32;
const MAX_TAG_LENGTH = 128;

function baseLanguage(value) {
  if (typeof value !== 'string' || !value.length || value.length > MAX_TAG_LENGTH) return null;
  try {
    return Intl.getCanonicalLocales(value)[0].split('-')[0].toLowerCase();
  } catch {
    return null;
  }
}

function result(effectiveLanguage, reason) {
  return Object.freeze({ effectiveLanguage, reason });
}

export function resolveLanguage(options = {}) {
  const input = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const { preference, deviceLanguages, availableLanguages = AVAILABLE_LANGUAGES } = input;
  const available = new Set(['tr']);
  if (Array.isArray(availableLanguages)) {
    // Only exact supported language IDs grant readiness, never a locale prefix.
    for (const language of SUPPORTED) {
      if (availableLanguages.includes(language)) available.add(language);
    }
  }

  if (preference !== undefined && preference !== 'auto') {
    if (!SUPPORTED.includes(preference)) return result('tr', 'unsupported-preference');
    return available.has(preference)
      ? result(preference, 'manual')
      : result('tr', 'unavailable-preference');
  }

  if (Array.isArray(deviceLanguages)) {
    const limit = Math.min(deviceLanguages.length, MAX_DEVICE_LANGUAGES);
    for (let index = 0; index < limit; index += 1) {
      const language = baseLanguage(deviceLanguages[index]);
      if (available.has(language)) return result(language, 'device');
    }
  }
  return result('tr', 'fallback');
}
