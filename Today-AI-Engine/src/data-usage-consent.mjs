const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;

export const CONSENT_SCHEMA_VERSION = 1;

export const DATA_CLASSES = deepFreeze({
  core: [
    "daily-choice",
    "color",
    "note"
  ],
  health: [
    "sleep",
    "energy",
    "symptoms",
    "activity",
    "hydration",
    "nutrition",
    "weight"
  ],
  sky: [
    "moment",
    "periods",
    "core-sky-snapshot"
  ]
});

const PROCESSING_POLICY = deepFreeze({
  mode: "device-only",
  externalRecipient: null,
  retention: "request-scoped"
});

function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new Set()) {
  if (
    !value ||
    typeof value !== "object" ||
    seen.has(value)
  ) {
    return value;
  }

  seen.add(value);
  Object.values(value).forEach(entry =>
    deepFreeze(entry, seen)
  );
  return Object.freeze(value);
}

function failure(code, details = {}) {
  return deepFreeze({
    ok: false,
    error: {
      code,
      ...details
    }
  });
}

function isDateTime(value) {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value))
  );
}

function normalizePermission(
  value,
  source,
  allowedClasses
) {
  if (!isPlainObject(value)) {
    return failure(
      "invalid-source-permission",
      { source }
    );
  }

  if (typeof value.allowed !== "boolean") {
    return failure(
      "invalid-source-permission",
      { source }
    );
  }

  if (
    !Array.isArray(value.dataClasses) ||
    typeof value.includeFreeText !== "boolean"
  ) {
    return failure(
      "invalid-source-permission",
      { source }
    );
  }

  const uniqueClasses = [
    ...new Set(value.dataClasses)
  ];

  if (
    uniqueClasses.length !==
      value.dataClasses.length ||
    uniqueClasses.some(
      dataClass =>
        !allowedClasses.includes(dataClass)
    )
  ) {
    return failure(
      "invalid-data-class",
      { source }
    );
  }

  if (
    value.allowed === false &&
    (
      uniqueClasses.length > 0 ||
      value.includeFreeText === true
    )
  ) {
    return failure(
      "disabled-source-has-permissions",
      { source }
    );
  }

  if (
    value.allowed === true &&
    uniqueClasses.length === 0
  ) {
    return failure(
      "enabled-source-has-no-data-class",
      { source }
    );
  }

  if (
    source === "sky" &&
    (
      value.includeFreeText !== false ||
      value.role !==
        "symbolic-context-only"
    )
  ) {
    return failure(
      "invalid-sky-boundary",
      { source }
    );
  }

  const normalized = {
    allowed: value.allowed,
    dataClasses: uniqueClasses,
    includeFreeText:
      value.includeFreeText
  };

  if (source === "sky") {
    normalized.role =
      "symbolic-context-only";
  }

  return deepFreeze({
    ok: true,
    permission: normalized
  });
}

/**
 * Veri kullanım onayını amaç, zaman ve cihaz-içi işleme sınırıyla
 * doğrular. Bu modül onayı saklamaz ve hiçbir kullanıcı verisine erişmez.
 */
export function evaluateDataUsageConsent(
  value,
  options = {}
) {
  if (!isPlainObject(value)) {
    return failure("invalid-consent");
  }

  if (
    value.schemaVersion !==
      CONSENT_SCHEMA_VERSION
  ) {
    return failure(
      "unsupported-consent-schema"
    );
  }

  if (
    typeof value.consentId !== "string" ||
    !IDENTIFIER_PATTERN.test(
      value.consentId
    )
  ) {
    return failure("invalid-consent-id");
  }

  const purpose =
    typeof value.purpose === "string"
      ? value.purpose.trim()
      : "";

  if (
    !purpose ||
    purpose.length > 160
  ) {
    return failure("invalid-consent-purpose");
  }

  if (
    options.purpose &&
    purpose !== options.purpose
  ) {
    return failure(
      "consent-purpose-mismatch"
    );
  }

  if (value.granted !== true) {
    return failure("consent-not-granted");
  }

  if (!isDateTime(value.grantedAt)) {
    return failure("invalid-consent-time");
  }

  if (
    value.revokedAt !== null &&
    value.revokedAt !== undefined
  ) {
    if (!isDateTime(value.revokedAt)) {
      return failure("invalid-revocation-time");
    }

    return failure("consent-revoked");
  }

  const evaluationTime =
    options.at || null;

  if (
    evaluationTime &&
    !isDateTime(evaluationTime)
  ) {
    return failure("invalid-evaluation-time");
  }

  if (
    evaluationTime &&
    Date.parse(value.grantedAt) >
      Date.parse(evaluationTime)
  ) {
    return failure("consent-granted-in-future");
  }

  if (
    !isPlainObject(value.processing) ||
    value.processing.mode !==
      PROCESSING_POLICY.mode ||
    value.processing.externalRecipient !==
      PROCESSING_POLICY.externalRecipient ||
    value.processing.retention !==
      PROCESSING_POLICY.retention
  ) {
    return failure(
      "unsupported-processing-policy"
    );
  }

  if (!isPlainObject(value.permissions)) {
    return failure("invalid-permissions");
  }

  const normalizedPermissions = {};

  for (const source of [
    "core",
    "health",
    "sky"
  ]) {
    const result = normalizePermission(
      value.permissions[source],
      source,
      DATA_CLASSES[source]
    );

    if (!result.ok) {
      return result;
    }

    normalizedPermissions[source] =
      result.permission;
  }

  if (
    !Object.values(
      normalizedPermissions
    ).some(permission => permission.allowed)
  ) {
    return failure("no-consented-source");
  }

  const consent = {
    schemaVersion:
      CONSENT_SCHEMA_VERSION,
    consentId: value.consentId,
    purpose,
    granted: true,
    grantedAt:
      new Date(value.grantedAt)
        .toISOString(),
    revokedAt: null,
    processing: clone(
      PROCESSING_POLICY
    ),
    permissions:
      normalizedPermissions
  };

  return deepFreeze({
    ok: true,
    consent
  });
}

export function isDataClassAllowed(
  consent,
  source,
  dataClass
) {
  const permission =
    consent?.permissions?.[source];

  return Boolean(
    permission?.allowed === true &&
    permission.dataClasses.includes(
      dataClass
    )
  );
}

export function canIncludeFreeText(
  consent,
  source
) {
  return Boolean(
    consent?.permissions?.[source]
      ?.allowed === true &&
    consent.permissions[source]
      .includeFreeText === true
  );
}

/**
 * Today App TB-018 adaptörünün beklediği dar onay görünümünü üretir.
 * Ek onay kapsamları yalnız AI Engine içinde kalır.
 */
export function toAppAdapterConsent(
  value,
  options = {}
) {
  const result =
    evaluateDataUsageConsent(
      value,
      options
    );

  if (!result.ok) {
    return null;
  }

  return deepFreeze({
    granted: true,
    purpose:
      result.consent.purpose,
    grantedAt:
      result.consent.grantedAt
  });
}

