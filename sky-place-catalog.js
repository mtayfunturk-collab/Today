/**
 * Today App — Sky Place Catalog
 * NUT-016.3 — Natal Harita Özeti
 *
 * Amaç:
 * - Doğum yerini cihazla birlikte gelen GeoNames şehir dizininde aramak
 * - Kullanıcıya koordinat ve IANA saat dilimi içeren açık eşleşme seçenekleri sunmak
 * - Arama metnini harici bir sunucuya göndermemek
 */
(function () {
  "use strict";

  const API_VERSION = 1;
  const RULESET_ID =
    "today:sky:place-catalog:nut-016.3";
  const EXPECTED_DATA_VERSION =
    "geonames-cities15000-package-1.0.1";
  const DATA_URL =
    "./data/sky-cities-15000.json";
  const DEFAULT_LIMIT = 8;
  const MAX_LIMIT = 20;

  let catalogPromise = null;
  let catalogState = Object.freeze({
    status: "idle",
    dataVersion: null,
    recordCount: 0,
    error: null
  });

  function createError(
    code,
    message,
    details = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodaySkyPlaceCatalogError";
    error.todayCode = code;
    error.details = details;
    if (cause) error.cause = cause;
    return error;
  }

  function clone(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== "object"
    ) {
      return value;
    }

    if (typeof window.structuredClone === "function") {
      return window.structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(key => {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function getCountryName(countryCode) {
    try {
      if (typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames(
          ["tr-TR", "tr", "en"],
          { type: "region" }
        ).of(countryCode) || countryCode;
      }
    } catch (error) {
      console.warn(
        "Today Sky: Ülke adı yerelleştirilemedi.",
        error
      );
    }

    return countryCode;
  }

  function setCatalogState(nextState) {
    catalogState = Object.freeze({
      ...catalogState,
      ...nextState
    });
  }

  function validatePayload(payload) {
    if (
      !payload ||
      payload.version !== EXPECTED_DATA_VERSION ||
      !Array.isArray(payload.records) ||
      !Array.isArray(payload.fields)
    ) {
      throw createError(
        "TODAY-SKY-PLACE-002",
        "Doğum yeri dizininin veri sürümü doğrulanamadı."
      );
    }

    return payload;
  }

  function buildCatalog(payload) {
    const countryNames = new Map();
    const entries = payload.records.map(record => {
      const [
        geonameId,
        name,
        asciiName,
        latitude,
        longitude,
        countryCode,
        admin1Code,
        population,
        timezoneId
      ] = record;

      if (!countryNames.has(countryCode)) {
        countryNames.set(
          countryCode,
          getCountryName(countryCode)
        );
      }

      const countryName =
        countryNames.get(countryCode);
      const normalizedName =
        normalizeSearchText(name);
      const normalizedAscii =
        normalizeSearchText(asciiName || name);
      const normalizedCountry =
        normalizeSearchText(countryName);
      const searchText = [
        normalizedName,
        normalizedAscii,
        normalizeSearchText(countryCode),
        normalizedCountry
      ]
        .filter(Boolean)
        .join(" ");

      return {
        geonameId,
        name,
        asciiName: asciiName || name,
        latitude,
        longitude,
        countryCode,
        countryName,
        admin1Code: admin1Code || null,
        population,
        timezoneId,
        normalizedName,
        normalizedAscii,
        searchText
      };
    });

    return {
      version: payload.version,
      source: payload.source,
      sourceUrl: payload.sourceUrl,
      license: payload.license,
      licenseUrl: payload.licenseUrl,
      entries,
      byId: new Map(
        entries.map(entry => [
          String(entry.geonameId),
          entry
        ])
      )
    };
  }

  async function loadCatalog() {
    if (catalogPromise) return catalogPromise;

    setCatalogState({
      status: "loading",
      error: null
    });

    catalogPromise = (async () => {
      try {
        const dataUrl = new URL(
          DATA_URL,
          document.baseURI
        );
        const response = await window.fetch(
          dataUrl.href,
          {
            cache: "force-cache",
            credentials: "same-origin"
          }
        );

        if (!response.ok) {
          throw createError(
            "TODAY-SKY-PLACE-001",
            "Doğum yeri dizini açılamadı.",
            { status: response.status }
          );
        }

        const payload = validatePayload(
          await response.json()
        );
        const catalog = buildCatalog(payload);

        setCatalogState({
          status: "ready",
          dataVersion: catalog.version,
          recordCount: catalog.entries.length,
          error: null
        });

        return catalog;
      } catch (error) {
        catalogPromise = null;
        setCatalogState({
          status: "error",
          dataVersion: null,
          recordCount: 0,
          error:
            error?.todayCode ||
            "TODAY-SKY-PLACE-999"
        });

        if (error?.todayCode) throw error;

        throw createError(
          "TODAY-SKY-PLACE-999",
          "Doğum yeri dizini yüklenemedi.",
          null,
          error
        );
      }
    })();

    return catalogPromise;
  }

  function toCandidate(entry, dataVersion) {
    return freezeClone({
      geonameId: entry.geonameId,
      name: entry.name,
      asciiName: entry.asciiName,
      label: `${entry.name}, ${entry.countryName}`,
      latitude: entry.latitude,
      longitude: entry.longitude,
      countryCode: entry.countryCode,
      countryName: entry.countryName,
      admin1Code: entry.admin1Code,
      population: entry.population,
      timezoneId: entry.timezoneId,
      source: "geonames",
      catalogVersion: dataVersion
    });
  }

  function scoreEntry(
    entry,
    normalizedQuery,
    primaryQuery
  ) {
    let rank = 50;

    if (
      entry.normalizedName === primaryQuery ||
      entry.normalizedAscii === primaryQuery
    ) {
      rank = 0;
    } else if (
      entry.normalizedName.startsWith(primaryQuery) ||
      entry.normalizedAscii.startsWith(primaryQuery)
    ) {
      rank = 10;
    } else if (
      entry.normalizedName.includes(primaryQuery) ||
      entry.normalizedAscii.includes(primaryQuery)
    ) {
      rank = 20;
    } else if (entry.searchText.includes(normalizedQuery)) {
      rank = 30;
    }

    return rank;
  }

  async function search(query, options = {}) {
    const normalizedQuery = normalizeSearchText(query);

    if (normalizedQuery.length < 2) {
      return Object.freeze([]);
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number(options.limit) || DEFAULT_LIMIT
      )
    );
    const primaryQuery = normalizeSearchText(
      String(query || "").split(",")[0]
    );
    const tokens = normalizedQuery.split(" ");
    const catalog = await loadCatalog();
    const matches = [];

    for (const entry of catalog.entries) {
      if (
        !tokens.every(token =>
          entry.searchText.includes(token)
        )
      ) {
        continue;
      }

      matches.push({
        entry,
        rank: scoreEntry(
          entry,
          normalizedQuery,
          primaryQuery
        )
      });
    }

    matches.sort((left, right) =>
      left.rank - right.rank ||
      right.entry.population -
        left.entry.population ||
      left.entry.name.localeCompare(
        right.entry.name,
        "tr"
      )
    );

    return Object.freeze(
      matches
        .slice(0, limit)
        .map(({ entry }) =>
          toCandidate(entry, catalog.version)
        )
    );
  }

  async function getCandidate(geonameId) {
    const catalog = await loadCatalog();
    const entry = catalog.byId.get(
      String(geonameId)
    );

    return entry
      ? toCandidate(entry, catalog.version)
      : null;
  }

  function getStatus() {
    return freezeClone(catalogState);
  }

  function getMetadata() {
    return freezeClone({
      dataVersion: EXPECTED_DATA_VERSION,
      source: "GeoNames cities15000",
      license: "CC BY 4.0",
      sourceUrl: "https://www.geonames.org/",
      licenseUrl:
        "https://creativecommons.org/licenses/by/4.0/"
    });
  }

  window.TodaySkyPlaceCatalog = Object.freeze({
    API_VERSION,
    RULESET_ID,
    DATA_VERSION: EXPECTED_DATA_VERSION,
    normalizeSearchText,
    loadCatalog,
    search,
    getCandidate,
    getStatus,
    getMetadata
  });
})();
