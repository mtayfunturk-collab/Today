/**
 * Today App v2
 * AI & Connect Adapter Interfaces
 * TB-018 — Platform Architecture
 *
 * Amaç:
 * - Today AI Engine ve Today Connect için bağımsız, sürümlü sözleşmeler sunmak
 * - Gerçek sağlayıcıları görünür ekranlardan ve uygulama verisi anahtarlarından ayırmak
 * - AI çıktısını öneri düzeyinde tutmak
 * - Connect yazma işlemlerini hazırlama ve açık kullanıcı onayı olarak ikiye ayırmak
 * - Sağlayıcı yüklenmediğinde mevcut Today akışlarını değiştirmemek
 */

(function () {
  "use strict";

  const ADAPTER_INTERFACE_VERSION = 1;
  const MAX_PENDING_ACTIONS = 20;
  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;

  let aiRecord = null;
  let connectRecord = null;
  const pendingActions = new Map();

  function dispatch(name, detail) {
    if (
      typeof window.dispatchEvent !== "function" ||
      typeof window.CustomEvent !== "function"
    ) {
      return;
    }

    window.dispatchEvent(
      new window.CustomEvent(name, {
        detail
      })
    );
  }

  function cleanText(value, maxLength = 240) {
    return (
      typeof value === "string"
        ? value.trim()
        : ""
    ).slice(0, maxLength);
  }

  function normalizeIdentifier(value) {
    const identifier =
      cleanText(value, 80).toLowerCase();

    return IDENTIFIER_PATTERN.test(identifier)
      ? identifier
      : null;
  }

  function normalizeStringList(
    value,
    options = {}
  ) {
    const maximum =
      Number.isInteger(options.maximum)
        ? options.maximum
        : 20;
    const itemLength =
      Number.isInteger(options.itemLength)
        ? options.itemLength
        : 120;
    const identifiersOnly =
      options.identifiersOnly === true;

    if (!Array.isArray(value)) {
      return null;
    }

    const normalized = [];

    for (const entry of value) {
      const item =
        identifiersOnly
          ? normalizeIdentifier(entry)
          : cleanText(entry, itemLength);

      if (!item) {
        return null;
      }

      if (!normalized.includes(item)) {
        normalized.push(item);
      }

      if (normalized.length > maximum) {
        return null;
      }
    }

    return Object.freeze(normalized);
  }

  function normalizeConsent(value) {
    if (
      !value ||
      typeof value !== "object" ||
      value.granted !== true
    ) {
      return null;
    }

    const purpose =
      cleanText(value.purpose, 160);

    if (!purpose) {
      return null;
    }

    const grantedAt =
      cleanText(value.grantedAt, 40);

    if (
      grantedAt &&
      Number.isNaN(
        Date.parse(grantedAt)
      )
    ) {
      return null;
    }

    return Object.freeze({
      granted: true,
      purpose,
      grantedAt:
        grantedAt || null
    });
  }

  function cloneTransferValue(value) {
    const seen = new Set();
    let nodeCount = 0;

    function visit(current, depth) {
      nodeCount += 1;

      if (
        depth > 6 ||
        nodeCount > 500
      ) {
        return {
          valid: false
        };
      }

      if (
        current === null ||
        typeof current === "boolean"
      ) {
        return {
          valid: true,
          value: current
        };
      }

      if (typeof current === "number") {
        return {
          valid:
            Number.isFinite(current),
          value: current
        };
      }

      if (typeof current === "string") {
        return {
          valid:
            current.length <= 8000,
          value: current
        };
      }

      if (
        typeof current !== "object" ||
        seen.has(current)
      ) {
        return {
          valid: false
        };
      }

      seen.add(current);

      if (Array.isArray(current)) {
        if (current.length > 100) {
          seen.delete(current);
          return {
            valid: false
          };
        }

        const cloned = [];

        for (const entry of current) {
          const result =
            visit(entry, depth + 1);

          if (!result.valid) {
            seen.delete(current);
            return {
              valid: false
            };
          }

          cloned.push(result.value);
        }

        seen.delete(current);

        return {
          valid: true,
          value:
            Object.freeze(cloned)
        };
      }

      if (
        Object.prototype.toString.call(
          current
        ) !== "[object Object]"
      ) {
        seen.delete(current);
        return {
          valid: false
        };
      }

      const keys =
        Object.keys(current);

      if (keys.length > 80) {
        seen.delete(current);
        return {
          valid: false
        };
      }

      const cloned = {};

      for (const key of keys) {
        if (
          key.length > 80 ||
          [
            "__proto__",
            "constructor",
            "prototype"
          ].includes(key)
        ) {
          seen.delete(current);
          return {
            valid: false
          };
        }

        const result =
          visit(
            current[key],
            depth + 1
          );

        if (!result.valid) {
          seen.delete(current);
          return {
            valid: false
          };
        }

        cloned[key] =
          result.value;
      }

      seen.delete(current);

      return {
        valid: true,
        value:
          Object.freeze(cloned)
      };
    }

    return visit(value, 0);
  }

  function describeAdapter(adapter, methods) {
    if (
      !adapter ||
      (
        typeof adapter !== "object" &&
        typeof adapter !== "function"
      )
    ) {
      return {
        valid: false,
        missingMethods: [
          ...methods
        ]
      };
    }

    const id =
      normalizeIdentifier(adapter.id);
    const version =
      cleanText(adapter.version, 40);
    const capabilities =
      normalizeStringList(
        adapter.capabilities,
        {
          maximum: 40,
          identifiersOnly: true
        }
      );
    const missingMethods =
      methods.filter(
        methodName =>
          typeof adapter[methodName] !==
          "function"
      );

    if (
      !id ||
      !version ||
      !capabilities ||
      capabilities.length === 0 ||
      missingMethods.length > 0
    ) {
      return {
        valid: false,
        id,
        version,
        capabilities,
        missingMethods
      };
    }

    return {
      valid: true,
      descriptor: Object.freeze({
        id,
        version,
        capabilities
      })
    };
  }

  function failure(
    eventName,
    errorCode,
    stage,
    details = {}
  ) {
    const eventDetail = {
      errorCode,
      stage
    };

    [
      "adapterId",
      "capability",
      "operation",
      "actionId",
      "errorName",
      "missingMethods"
    ].forEach(key => {
      const value = details[key];

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        Array.isArray(value)
      ) {
        eventDetail[key] = value;
      }
    });

    dispatch(eventName, eventDetail);

    return Object.freeze({
      success: false,
      errorCode
    });
  }

  function adapterStatus(record) {
    return Object.freeze({
      interfaceVersion:
        ADAPTER_INTERFACE_VERSION,
      available: Boolean(record),
      adapter:
        record
          ? record.descriptor
          : null
    });
  }

  function registerAIAdapter(adapter) {
    const validation =
      describeAdapter(
        adapter,
        ["propose"]
      );

    if (!validation.valid) {
      return failure(
        "today:ai-adapter-error",
        "TODAY-AI-ADAPTER-001",
        "register",
        {
          adapterId:
            validation.id || "",
          missingMethods:
            validation.missingMethods
        }
      );
    }

    if (aiRecord) {
      if (
        aiRecord.implementation === adapter &&
        aiRecord.descriptor.id ===
          validation.descriptor.id
      ) {
        return Object.freeze({
          success: true,
          changed: false,
          adapter:
            aiRecord.descriptor
        });
      }

      return failure(
        "today:ai-adapter-error",
        "TODAY-AI-ADAPTER-002",
        "register",
        {
          adapterId:
            validation.descriptor.id
        }
      );
    }

    aiRecord = {
      implementation: adapter,
      descriptor:
        validation.descriptor
    };

    dispatch(
      "today:ai-adapter-ready",
      {
        adapterId:
          validation.descriptor.id,
        capabilities: [
          ...validation
            .descriptor
            .capabilities
        ]
      }
    );

    return Object.freeze({
      success: true,
      changed: true,
      adapter:
        validation.descriptor
    });
  }

  function unregisterAIAdapter(adapterId) {
    if (!aiRecord) {
      return Object.freeze({
        success: true,
        changed: false
      });
    }

    const normalizedId =
      normalizeIdentifier(adapterId);

    if (
      !normalizedId ||
      normalizedId !==
        aiRecord.descriptor.id
    ) {
      return failure(
        "today:ai-adapter-error",
        "TODAY-AI-ADAPTER-008",
        "unregister",
        {
          adapterId:
            normalizedId || ""
        }
      );
    }

    const removedId =
      aiRecord.descriptor.id;
    aiRecord = null;

    dispatch(
      "today:ai-adapter-change",
      {
        adapterId: removedId,
        available: false
      }
    );

    return Object.freeze({
      success: true,
      changed: true
    });
  }

  function getAICapabilities() {
    return Object.freeze(
      aiRecord
        ? [
            ...aiRecord
              .descriptor
              .capabilities
          ]
        : []
    );
  }

  function normalizeAIRequest(request) {
    if (
      !request ||
      typeof request !== "object"
    ) {
      return null;
    }

    const requestId =
      normalizeIdentifier(
        request.requestId
      );
    const capability =
      normalizeIdentifier(
        request.capability
      );
    const intent =
      cleanText(request.intent, 240);
    const consent =
      normalizeConsent(
        request.consent
      );

    if (
      !requestId ||
      !capability ||
      !intent ||
      !consent
    ) {
      return null;
    }

    const normalized = {
      requestId,
      capability,
      intent,
      consent
    };

    if (
      Object.prototype.hasOwnProperty.call(
        request,
        "input"
      )
    ) {
      const input =
        cloneTransferValue(
          request.input
        );

      if (!input.valid) {
        return null;
      }

      normalized.input =
        input.value;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        request,
        "context"
      )
    ) {
      const context =
        cloneTransferValue(
          request.context
        );

      if (!context.valid) {
        return null;
      }

      normalized.context =
        context.value;
    }

    return Object.freeze(normalized);
  }

  function normalizeProposal(value) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return null;
    }

    const proposalId =
      normalizeIdentifier(
        value.proposalId
      );
    const suggestion =
      cleanText(value.suggestion, 800);
    const basis =
      normalizeStringList(
        value.basis,
        {
          maximum: 12,
          itemLength: 240
        }
      );
    const confidence =
      typeof value.confidence ===
        "number" &&
      Number.isFinite(value.confidence) &&
      value.confidence >= 0 &&
      value.confidence <= 1
        ? value.confidence
        : null;
    const uncertainty =
      cleanText(
        value.uncertainty,
        500
      );
    const requiresApproval =
      typeof value.requiresApproval ===
        "boolean"
        ? value.requiresApproval
        : null;

    if (
      !proposalId ||
      !suggestion ||
      !basis ||
      confidence === null ||
      !uncertainty ||
      requiresApproval === null ||
      !Array.isArray(value.options)
    ) {
      return null;
    }

    const options = [];

    for (const option of value.options) {
      if (
        !option ||
        typeof option !== "object"
      ) {
        return null;
      }

      const id =
        normalizeIdentifier(option.id);
      const label =
        cleanText(option.label, 160);
      const connectCapability =
        option.connectCapability ===
          undefined
          ? null
          : normalizeIdentifier(
              option.connectCapability
            );

      if (
        !id ||
        !label ||
        (
          option.connectCapability !==
            undefined &&
          !connectCapability
        )
      ) {
        return null;
      }

      options.push(
        Object.freeze({
          id,
          label,
          connectCapability,
          requiresApproval:
            option.requiresApproval !==
              false
        })
      );

      if (options.length > 8) {
        return null;
      }
    }

    if (
      options.some(
        option =>
          option.connectCapability
      ) &&
      requiresApproval !== true
    ) {
      return null;
    }

    return Object.freeze({
      proposalId,
      suggestion,
      basis,
      confidence,
      uncertainty,
      options: Object.freeze(options),
      requiresApproval
    });
  }

  function requestProposal(request) {
    if (!aiRecord) {
      return Promise.resolve(
        failure(
          "today:ai-adapter-error",
          "TODAY-AI-ADAPTER-003",
          "request"
        )
      );
    }

    const normalizedRequest =
      normalizeAIRequest(request);

    if (!normalizedRequest) {
      return Promise.resolve(
        failure(
          "today:ai-adapter-error",
          "TODAY-AI-ADAPTER-004",
          "request",
          {
            adapterId:
              aiRecord.descriptor.id
          }
        )
      );
    }

    if (
      !aiRecord
        .descriptor
        .capabilities
        .includes(
          normalizedRequest.capability
        )
    ) {
      return Promise.resolve(
        failure(
          "today:ai-adapter-error",
          "TODAY-AI-ADAPTER-005",
          "capability",
          {
            adapterId:
              aiRecord.descriptor.id,
            capability:
              normalizedRequest.capability
          }
        )
      );
    }

    const activeRecord = aiRecord;

    return Promise.resolve()
      .then(() =>
        activeRecord
          .implementation
          .propose(
            normalizedRequest
          )
      )
      .then(value => {
        if (aiRecord !== activeRecord) {
          return failure(
            "today:ai-adapter-error",
            "TODAY-AI-ADAPTER-009",
            "lifecycle",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id,
              capability:
                normalizedRequest
                  .capability
            }
          );
        }

        const proposal =
          normalizeProposal(value);

        if (!proposal) {
          return failure(
            "today:ai-adapter-error",
            "TODAY-AI-ADAPTER-006",
            "response",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id,
              capability:
                normalizedRequest
                  .capability
            }
          );
        }

        return Object.freeze({
          success: true,
          proposal
        });
      })
      .catch(error =>
        failure(
          "today:ai-adapter-error",
          "TODAY-AI-ADAPTER-007",
          "provider",
          {
            adapterId:
              activeRecord
                .descriptor
                .id,
            capability:
              normalizedRequest
                .capability,
            errorName:
              error &&
              error.name
          }
        )
      );
  }

  function registerConnectAdapter(adapter) {
    const validation =
      describeAdapter(
        adapter,
        [
          "prepare",
          "execute"
        ]
      );

    if (!validation.valid) {
      return failure(
        "today:connect-adapter-error",
        "TODAY-CONNECT-ADAPTER-001",
        "register",
        {
          adapterId:
            validation.id || "",
          missingMethods:
            validation.missingMethods
        }
      );
    }

    if (connectRecord) {
      if (
        connectRecord.implementation ===
          adapter &&
        connectRecord.descriptor.id ===
          validation.descriptor.id
      ) {
        return Object.freeze({
          success: true,
          changed: false,
          adapter:
            connectRecord.descriptor
        });
      }

      return failure(
        "today:connect-adapter-error",
        "TODAY-CONNECT-ADAPTER-002",
        "register",
        {
          adapterId:
            validation.descriptor.id
        }
      );
    }

    connectRecord = {
      implementation: adapter,
      descriptor:
        validation.descriptor
    };

    dispatch(
      "today:connect-adapter-ready",
      {
        adapterId:
          validation.descriptor.id,
        capabilities: [
          ...validation
            .descriptor
            .capabilities
        ]
      }
    );

    return Object.freeze({
      success: true,
      changed: true,
      adapter:
        validation.descriptor
    });
  }

  function unregisterConnectAdapter(
    adapterId
  ) {
    if (!connectRecord) {
      return Object.freeze({
        success: true,
        changed: false,
        clearedActions: 0
      });
    }

    const normalizedId =
      normalizeIdentifier(adapterId);

    if (
      !normalizedId ||
      normalizedId !==
        connectRecord.descriptor.id
    ) {
      return failure(
        "today:connect-adapter-error",
        "TODAY-CONNECT-ADAPTER-012",
        "unregister",
        {
          adapterId:
            normalizedId || ""
        }
      );
    }

    const removedId =
      connectRecord.descriptor.id;
    const executing =
      Array.from(
        pendingActions.values()
      ).some(
        entry =>
          entry.status ===
            "executing"
      );

    if (executing) {
      return failure(
        "today:connect-adapter-error",
        "TODAY-CONNECT-ADAPTER-019",
        "unregister",
        {
          adapterId:
            removedId
        }
      );
    }

    const clearedActions =
      pendingActions.size;

    pendingActions.clear();
    connectRecord = null;

    dispatch(
      "today:connect-adapter-change",
      {
        adapterId: removedId,
        available: false,
        clearedActions
      }
    );

    return Object.freeze({
      success: true,
      changed: true,
      clearedActions
    });
  }

  function getConnectCapabilities() {
    return Object.freeze(
      connectRecord
        ? [
            ...connectRecord
              .descriptor
              .capabilities
          ]
        : []
    );
  }

  function normalizeConnectRequest(request) {
    if (
      !request ||
      typeof request !== "object"
    ) {
      return null;
    }

    const requestId =
      normalizeIdentifier(
        request.requestId
      );
    const capability =
      normalizeIdentifier(
        request.capability
      );
    const operation =
      normalizeIdentifier(
        request.operation
      );
    const summary =
      cleanText(request.summary, 320);
    const consent =
      normalizeConsent(
        request.consent
      );

    if (
      !requestId ||
      !capability ||
      !operation ||
      !summary ||
      !consent
    ) {
      return null;
    }

    const normalized = {
      requestId,
      capability,
      operation,
      summary,
      consent
    };

    if (
      Object.prototype.hasOwnProperty.call(
        request,
        "payload"
      )
    ) {
      const payload =
        cloneTransferValue(
          request.payload
        );

      if (!payload.valid) {
        return null;
      }

      normalized.payload =
        payload.value;
    }

    return Object.freeze(normalized);
  }

  function normalizePreparedAction(
    value,
    request
  ) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return null;
    }

    const providerPrepared =
      cloneTransferValue(value);

    if (!providerPrepared.valid) {
      return null;
    }

    const snapshot =
      providerPrepared.value;
    const actionId =
      normalizeIdentifier(
        snapshot.actionId
      );
    const summary =
      cleanText(
        snapshot.summary,
        320
      );
    const permissionScopes =
      normalizeStringList(
        snapshot.permissionScopes,
        {
          maximum: 20,
          identifiersOnly: true
        }
      );
    const expiresAt =
      snapshot.expiresAt ===
        undefined ||
      snapshot.expiresAt === null
        ? null
        : cleanText(
            snapshot.expiresAt,
            40
          );

    if (
      !actionId ||
      !summary ||
      !permissionScopes ||
      snapshot.requiresApproval !==
        true ||
      (
        expiresAt &&
        Number.isNaN(
          Date.parse(expiresAt)
        )
      )
    ) {
      return null;
    }

    return {
      actionId,
      requestId:
        request.requestId,
      capability:
        request.capability,
      operation:
        request.operation,
      summary,
      permissionScopes,
      expiresAt,
      preview:
        Object.prototype.hasOwnProperty.call(
          snapshot,
          "preview"
        )
          ? snapshot.preview
          : null,
      requiresApproval: true,
      providerPrepared:
        snapshot
    };
  }

  function publicPendingAction(entry) {
    return Object.freeze({
      actionId:
        entry.actionId,
      requestId:
        entry.requestId,
      adapterId:
        entry.adapterId,
      capability:
        entry.capability,
      operation:
        entry.operation,
      summary:
        entry.summary,
      permissionScopes:
        entry.permissionScopes,
      expiresAt:
        entry.expiresAt,
      preview:
        entry.preview,
      requiresApproval: true,
      status:
        entry.status
    });
  }

  function prepareAction(request) {
    if (!connectRecord) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-003",
          "prepare"
        )
      );
    }

    if (
      pendingActions.size >=
      MAX_PENDING_ACTIONS
    ) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-004",
          "prepare",
          {
            adapterId:
              connectRecord
                .descriptor
                .id
          }
        )
      );
    }

    const normalizedRequest =
      normalizeConnectRequest(request);

    if (!normalizedRequest) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-005",
          "prepare",
          {
            adapterId:
              connectRecord
                .descriptor
                .id
          }
        )
      );
    }

    if (
      !connectRecord
        .descriptor
        .capabilities
        .includes(
          normalizedRequest.capability
        )
    ) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-006",
          "capability",
          {
            adapterId:
              connectRecord
                .descriptor
                .id,
            capability:
              normalizedRequest.capability,
            operation:
              normalizedRequest.operation
          }
        )
      );
    }

    const activeRecord =
      connectRecord;

    return Promise.resolve()
      .then(() =>
        activeRecord
          .implementation
          .prepare(
            normalizedRequest
          )
      )
      .then(value => {
        if (
          connectRecord !==
            activeRecord
        ) {
          return failure(
            "today:connect-adapter-error",
            "TODAY-CONNECT-ADAPTER-020",
            "lifecycle",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id,
              capability:
                normalizedRequest
                  .capability,
              operation:
                normalizedRequest
                  .operation
            }
          );
        }

        if (
          pendingActions.size >=
          MAX_PENDING_ACTIONS
        ) {
          return failure(
            "today:connect-adapter-error",
            "TODAY-CONNECT-ADAPTER-004",
            "prepare",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id
            }
          );
        }

        const prepared =
          normalizePreparedAction(
            value,
            normalizedRequest
          );

        if (!prepared) {
          return failure(
            "today:connect-adapter-error",
            "TODAY-CONNECT-ADAPTER-007",
            "response",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id,
              capability:
                normalizedRequest
                  .capability,
              operation:
                normalizedRequest
                  .operation
            }
          );
        }

        if (
          pendingActions.has(
            prepared.actionId
          )
        ) {
          return failure(
            "today:connect-adapter-error",
            "TODAY-CONNECT-ADAPTER-008",
            "response",
            {
              adapterId:
                activeRecord
                  .descriptor
                  .id,
              capability:
                normalizedRequest
                  .capability,
              operation:
                normalizedRequest
                  .operation,
              actionId:
                prepared.actionId
            }
          );
        }

        const entry = {
          ...prepared,
          adapterId:
            activeRecord
              .descriptor
              .id,
          status: "pending"
        };

        pendingActions.set(
          prepared.actionId,
          entry
        );

        return Object.freeze({
          success: true,
          action:
            publicPendingAction(
              entry
            )
        });
      })
      .catch(error =>
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-009",
          "provider",
          {
            adapterId:
              activeRecord
                .descriptor
                .id,
            capability:
              normalizedRequest
                .capability,
            operation:
              normalizedRequest
                .operation,
            errorName:
              error &&
              error.name
          }
        )
      );
  }

  function normalizeApproval(
    actionId,
    approval
  ) {
    if (
      !approval ||
      typeof approval !== "object" ||
      approval.approved !== true
    ) {
      return null;
    }

    const approvalActionId =
      normalizeIdentifier(
        approval.actionId
      );
    const approvedAt =
      cleanText(
        approval.approvedAt,
        40
      );

    if (
      approvalActionId !== actionId ||
      !approvedAt ||
      Number.isNaN(
        Date.parse(approvedAt)
      )
    ) {
      return null;
    }

    return Object.freeze({
      actionId,
      approved: true,
      approvedAt
    });
  }

  function approveAction(
    actionId,
    approval
  ) {
    const normalizedActionId =
      normalizeIdentifier(actionId);
    const entry =
      normalizedActionId
        ? pendingActions.get(
            normalizedActionId
          )
        : null;

    if (!entry) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-010",
          "approval",
          {
            actionId:
              normalizedActionId || ""
          }
        )
      );
    }

    if (
      !connectRecord ||
      connectRecord.descriptor.id !==
        entry.adapterId
    ) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-013",
          "approval",
          {
            adapterId:
              entry.adapterId,
            actionId:
              entry.actionId
          }
        )
      );
    }

    if (entry.status !== "pending") {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-014",
          "approval",
          {
            adapterId:
              entry.adapterId,
            actionId:
              entry.actionId
          }
        )
      );
    }

    if (
      entry.expiresAt &&
      Date.parse(entry.expiresAt) <=
        Date.now()
    ) {
      pendingActions.delete(
        entry.actionId
      );

      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-015",
          "approval",
          {
            adapterId:
              entry.adapterId,
            actionId:
              entry.actionId
          }
        )
      );
    }

    const normalizedApproval =
      normalizeApproval(
        entry.actionId,
        approval
      );

    if (!normalizedApproval) {
      return Promise.resolve(
        failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-011",
          "approval",
          {
            adapterId:
              entry.adapterId,
            capability:
              entry.capability,
            operation:
              entry.operation,
            actionId:
              entry.actionId
          }
        )
      );
    }

    const activeRecord =
      connectRecord;
    entry.status = "executing";

    return Promise.resolve()
      .then(() =>
        activeRecord
          .implementation
          .execute(
            entry.providerPrepared,
            normalizedApproval
          )
      )
      .then(value => {
        if (
          value &&
          typeof value === "object" &&
          value.success === false
        ) {
          entry.status = "pending";

          return failure(
            "today:connect-adapter-error",
            "TODAY-CONNECT-ADAPTER-016",
            "execute",
            {
              adapterId:
                entry.adapterId,
              capability:
                entry.capability,
              operation:
                entry.operation,
              actionId:
                entry.actionId
            }
          );
        }

        pendingActions.delete(
          entry.actionId
        );

        return Object.freeze({
          success: true,
          actionId:
            entry.actionId,
          result:
            value === undefined
              ? null
              : value
        });
      })
      .catch(error => {
        entry.status = "pending";

        return failure(
          "today:connect-adapter-error",
          "TODAY-CONNECT-ADAPTER-017",
          "execute",
          {
            adapterId:
              entry.adapterId,
            capability:
              entry.capability,
            operation:
              entry.operation,
            actionId:
              entry.actionId,
            errorName:
              error &&
              error.name
          }
        );
      });
  }

  function cancelAction(actionId) {
    const normalizedActionId =
      normalizeIdentifier(actionId);
    const entry =
      normalizedActionId
        ? pendingActions.get(
            normalizedActionId
          )
        : null;

    if (!entry) {
      return Object.freeze({
        success: true,
        changed: false
      });
    }

    if (entry.status === "executing") {
      return failure(
        "today:connect-adapter-error",
        "TODAY-CONNECT-ADAPTER-018",
        "cancel",
        {
          adapterId:
            entry.adapterId,
          actionId:
            entry.actionId
        }
      );
    }

    pendingActions.delete(
      entry.actionId
    );

    return Object.freeze({
      success: true,
      changed: true
    });
  }

  function getPendingActions() {
    return Object.freeze(
      Array.from(
        pendingActions.values(),
        entry =>
          publicPendingAction(
            entry
          )
      )
    );
  }

  function getConnectStatus() {
    const status =
      adapterStatus(connectRecord);

    return Object.freeze({
      ...status,
      pendingActionCount:
        pendingActions.size,
      maxPendingActions:
        MAX_PENDING_ACTIONS
    });
  }

  window.TodayAI = Object.freeze({
    ADAPTER_INTERFACE_VERSION,
    registerAdapter:
      registerAIAdapter,
    unregisterAdapter:
      unregisterAIAdapter,
    getStatus() {
      return adapterStatus(aiRecord);
    },
    getCapabilities:
      getAICapabilities,
    requestProposal
  });

  window.TodayConnect = Object.freeze({
    ADAPTER_INTERFACE_VERSION,
    MAX_PENDING_ACTIONS,
    registerAdapter:
      registerConnectAdapter,
    unregisterAdapter:
      unregisterConnectAdapter,
    getStatus:
      getConnectStatus,
    getCapabilities:
      getConnectCapabilities,
    prepareAction,
    approveAction,
    cancelAction,
    getPendingActions
  });

  dispatch(
    "today:adapter-interfaces-ready",
    {
      version:
        ADAPTER_INTERFACE_VERSION,
      aiAvailable: false,
      connectAvailable: false
    }
  );

  console.info(
    "Today AI ve Connect adaptör arayüzleri hazır."
  );
})();
