const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/adapter-interfaces.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

function createRuntime() {
  const events = [];

  const window = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  };

  vm.runInNewContext(
    source,
    {
      window,
      console: {
        info() {},
        warn() {},
        error() {}
      },
      Promise,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Map,
      Error
    },
    {
      filename: SOURCE_PATH
    }
  );

  return {
    window,
    events,
    eventsOf(type) {
      return events.filter(
        event =>
          event.type === type
      );
    }
  };
}

function createAIAdapter(
  overrides = {}
) {
  return {
    id: "today-ai-test",
    version: "1.0.0",
    capabilities: [
      "reflection.summary",
      "planning.draft"
    ],
    async propose() {
      return {
        proposalId:
          "proposal-1",
        suggestion:
          "Bugünkü kaydı kısa bir özet olarak ele al.",
        basis: [
          "Kullanıcının açıkça paylaştığı kayıt"
        ],
        confidence: 0.72,
        uncertainty:
          "Tek günlük veri sınırlı olabilir.",
        options: [
          {
            id: "keep-local",
            label:
              "Yalnızca taslağı göster"
          }
        ],
        requiresApproval: false
      };
    },
    ...overrides
  };
}

function createConnectAdapter(
  overrides = {}
) {
  let prepareSequence = 0;

  return {
    id: "today-connect-test",
    version: "1.0.0",
    capabilities: [
      "calendar.write",
      "email.draft"
    ],
    async prepare(request) {
      prepareSequence += 1;

      return {
        actionId:
          `action-${prepareSequence}`,
        summary:
          request.summary,
        permissionScopes: [
          request.capability
        ],
        requiresApproval: true,
        preview: {
          title: "Today"
        }
      };
    },
    async execute() {
      return {
        success: true,
        providerReference:
          "provider-1"
      };
    },
    ...overrides
  };
}

function aiRequest(
  overrides = {}
) {
  return {
    requestId: "request-ai-1",
    capability:
      "reflection.summary",
    intent:
      "Bugünkü kaydı özetle",
    input: {
      choice: "B"
    },
    consent: {
      granted: true,
      purpose:
        "Kullanıcının istediği özeti üretmek",
      grantedAt:
        "2026-07-30T12:00:00.000Z"
    },
    ...overrides
  };
}

function connectRequest(
  overrides = {}
) {
  return {
    requestId:
      "request-connect-1",
    capability:
      "calendar.write",
    operation:
      "calendar.create",
    summary:
      "Yarın 10:00 için Today hatırlatması oluştur",
    payload: {
      startsAt:
        "2026-07-31T10:00:00+03:00"
    },
    consent: {
      granted: true,
      purpose:
        "Kullanıcının istediği takvim taslağını hazırlamak",
      grantedAt:
        "2026-07-30T12:00:00.000Z"
    },
    ...overrides
  };
}

function approvalFor(actionId) {
  return {
    actionId,
    approved: true,
    approvedAt:
      "2026-07-30T12:05:00.000Z"
  };
}

const results = [];

async function test(name, callback) {
  try {
    await callback();
    results.push({
      name,
      success: true
    });
  } catch (error) {
    results.push({
      name,
      success: false,
      error: error.message
    });
  }
}

(async () => {
  await test(
    "AI ve Connect arayüzleri sürümlü ve değişmez olarak dışa açılıyor",
    () => {
      const runtime = createRuntime();
      const ai =
        runtime.window.TodayAI;
      const connect =
        runtime.window.TodayConnect;

      assert.equal(
        ai.ADAPTER_INTERFACE_VERSION,
        1
      );
      assert.equal(
        connect.ADAPTER_INTERFACE_VERSION,
        1
      );
      assert.equal(
        connect.MAX_PENDING_ACTIONS,
        20
      );
      assert.equal(
        Object.isFrozen(ai),
        true
      );
      assert.equal(
        Object.isFrozen(connect),
        true
      );
    }
  );

  await test(
    "Gerçek sağlayıcı olmadan iki arayüz de pasif ve mevcut akışa müdahalesiz başlıyor",
    () => {
      const runtime = createRuntime();

      assert.equal(
        runtime.window
          .TodayAI
          .getStatus()
          .available,
        false
      );
      assert.equal(
        runtime.window
          .TodayConnect
          .getStatus()
          .available,
        false
      );
      assert.equal(
        runtime.window
          .TodayAI
          .getCapabilities()
          .length,
        0
      );
      assert.equal(
        runtime.window
          .TodayConnect
          .getPendingActions()
          .length,
        0
      );
    }
  );

  await test(
    "Arayüz hazır olayı gerçek sağlayıcı varmış gibi bildirim yapmıyor",
    () => {
      const runtime = createRuntime();
      const events =
        runtime.eventsOf(
          "today:adapter-interfaces-ready"
        );

      assert.equal(events.length, 1);
      assert.equal(
        events[0].detail.aiAvailable,
        false
      );
      assert.equal(
        events[0].detail.connectAvailable,
        false
      );
    }
  );

  await test(
    "Eksik propose sözleşmesine sahip AI adaptörü reddediliyor",
    () => {
      const runtime = createRuntime();
      const result =
        runtime.window
          .TodayAI
          .registerAdapter({
            id: "broken-ai",
            version: "1.0.0",
            capabilities: [
              "reflection.summary"
            ]
          });

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-001"
      );
      assert.equal(
        runtime.eventsOf(
          "today:ai-adapter-error"
        ).length,
        1
      );
    }
  );

  await test(
    "Geçerli AI adaptörü kimlik ve yetenekleriyle kaydediliyor",
    () => {
      const runtime = createRuntime();
      const adapter =
        createAIAdapter();
      const result =
        runtime.window
          .TodayAI
          .registerAdapter(adapter);

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.changed,
        true
      );
      assert.equal(
        result.adapter.id,
        "today-ai-test"
      );
      assert.equal(
        runtime.eventsOf(
          "today:ai-adapter-ready"
        ).length,
        1
      );
    }
  );

  await test(
    "Aynı AI adaptörünün ikinci kaydı idempotent kalıyor",
    () => {
      const runtime = createRuntime();
      const adapter =
        createAIAdapter();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(adapter);
      const second =
        api.registerAdapter(adapter);

      assert.equal(
        second.success,
        true
      );
      assert.equal(
        second.changed,
        false
      );
      assert.equal(
        runtime.eventsOf(
          "today:ai-adapter-ready"
        ).length,
        1
      );
    }
  );

  await test(
    "Kayıtlı AI adaptörünün sessizce başka sağlayıcıyla değiştirilmesi engelleniyor",
    () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter()
      );
      const result =
        api.registerAdapter(
          createAIAdapter({
            id: "another-ai"
          })
        );

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-002"
      );
      assert.equal(
        api.getStatus().adapter.id,
        "today-ai-test"
      );
    }
  );

  await test(
    "AI sağlayıcısı yokken öneri isteği kontrollü sonuç dönüyor",
    async () => {
      const runtime = createRuntime();
      const result =
        await runtime.window
          .TodayAI
          .requestProposal(
            aiRequest()
          );

      assert.equal(
        result.success,
        false
      );
      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-003"
      );
    }
  );

  await test(
    "Açık veri kullanım onayı olmayan AI isteği sağlayıcıya ulaşmıyor",
    async () => {
      let calls = 0;
      const runtime = createRuntime();
      const adapter =
        createAIAdapter({
          async propose() {
            calls += 1;
            return {};
          }
        });

      runtime.window
        .TodayAI
        .registerAdapter(adapter);

      const result =
        await runtime.window
          .TodayAI
          .requestProposal(
            aiRequest({
              consent: {
                granted: false
              }
            })
          );

      assert.equal(calls, 0);
      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-004"
      );
    }
  );

  await test(
    "Desteklenmeyen AI yeteneği sağlayıcıya ulaşmıyor",
    async () => {
      let calls = 0;
      const runtime = createRuntime();
      const adapter =
        createAIAdapter({
          async propose() {
            calls += 1;
            return {};
          }
        });

      runtime.window
        .TodayAI
        .registerAdapter(adapter);

      const result =
        await runtime.window
          .TodayAI
          .requestProposal(
            aiRequest({
              capability:
                "health.diagnosis"
            })
          );

      assert.equal(calls, 0);
      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-005"
      );
    }
  );

  await test(
    "AI sağlayıcısı yalnız açık istek zarfını alıyor ve zarfı değiştiremiyor",
    async () => {
      let received;
      const input = {
        choice: "B"
      };
      const runtime = createRuntime();
      const adapter =
        createAIAdapter({
          async propose(request) {
            received = request;
            return createAIAdapter()
              .propose();
          }
        });

      runtime.window
        .TodayAI
        .registerAdapter(adapter);
      await runtime.window
        .TodayAI
        .requestProposal(
          aiRequest({ input })
        );

      assert.equal(
        Object.isFrozen(received),
        true
      );
      assert.equal(
        received.input === input,
        false
      );
      assert.equal(
        received.input.choice,
        "B"
      );
      assert.equal(
        Object.isFrozen(
          received.input
        ),
        true
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          received,
          "state"
        ),
        false
      );
    }
  );

  await test(
    "Kaldırılan AI adaptörünün geciken yanıtı etkin öneri olarak kabul edilmiyor",
    async () => {
      let resolveProposal;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;
      const adapter =
        createAIAdapter({
          propose() {
            return new Promise(resolve => {
              resolveProposal =
                resolve;
            });
          }
        });

      api.registerAdapter(adapter);
      const request =
        api.requestProposal(
          aiRequest()
        );

      await Promise.resolve();
      api.unregisterAdapter(
        "today-ai-test"
      );
      resolveProposal(
        await createAIAdapter()
          .propose()
      );

      const result =
        await request;

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-009"
      );
    }
  );

  await test(
    "Geçerli AI yanıtı öneri, dayanak, güven ve belirsizlik alanlarıyla dönüyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter()
      );
      const result =
        await api.requestProposal(
          aiRequest()
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.proposal
          .proposalId,
        "proposal-1"
      );
      assert.equal(
        result.proposal
          .confidence,
        0.72
      );
      assert.equal(
        result.proposal
          .basis.length,
        1
      );
      assert.equal(
        Object.isFrozen(
          result.proposal
        ),
        true
      );
    }
  );

  await test(
    "Eksik açıklanabilirlik alanları taşıyan AI yanıtı reddediliyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter({
          async propose() {
            return {
              proposalId:
                "proposal-1",
              suggestion:
                "Eksik yanıt"
            };
          }
        })
      );

      const result =
        await api.requestProposal(
          aiRequest()
        );

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-006"
      );
    }
  );

  await test(
    "Connect eylemi öneren AI seçeneği onaysız olarak işaretlenemiyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter({
          async propose() {
            return {
              proposalId:
                "proposal-connect",
              suggestion:
                "Takvime ekleme taslağı",
              basis: [
                "Kullanıcı isteği"
              ],
              confidence: 0.9,
              uncertainty:
                "Saat yeniden kontrol edilmeli.",
              options: [
                {
                  id: "calendar",
                  label:
                    "Takvime ekle",
                  connectCapability:
                    "calendar.write"
                }
              ],
              requiresApproval:
                false
            };
          }
        })
      );

      const result =
        await api.requestProposal(
          aiRequest()
        );

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-006"
      );
    }
  );

  await test(
    "AI sağlayıcı hatası kişisel istek içeriğini hata olayına taşımıyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter({
          async propose() {
            throw new TypeError(
              "provider failed"
            );
          }
        })
      );

      const result =
        await api.requestProposal(
          aiRequest({
            input: {
              privateNote:
                "gizli-not"
            }
          })
        );
      const event =
        runtime.eventsOf(
          "today:ai-adapter-error"
        ).at(-1);

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-007"
      );
      assert.equal(
        JSON.stringify(
          event.detail
        ).includes("gizli-not"),
        false
      );
    }
  );

  await test(
    "Yanlış kimlikle AI adaptörü kaldırılamıyor",
    () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter()
      );
      const result =
        api.unregisterAdapter(
          "another-ai"
        );

      assert.equal(
        result.errorCode,
        "TODAY-AI-ADAPTER-008"
      );
      assert.equal(
        api.getStatus().available,
        true
      );
    }
  );

  await test(
    "Doğru kimlikle AI adaptörü güvenli biçimde kaldırılıyor",
    () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayAI;

      api.registerAdapter(
        createAIAdapter()
      );
      const result =
        api.unregisterAdapter(
          "today-ai-test"
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.changed,
        true
      );
      assert.equal(
        api.getStatus().available,
        false
      );
    }
  );

  await test(
    "Eksik execute sözleşmesine sahip Connect adaptörü reddediliyor",
    () => {
      const runtime = createRuntime();
      const result =
        runtime.window
          .TodayConnect
          .registerAdapter({
            id: "broken-connect",
            version: "1.0.0",
            capabilities: [
              "calendar.write"
            ],
            prepare() {}
          });

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-001"
      );
    }
  );

  await test(
    "Geçerli Connect adaptörü yetenekleriyle kaydediliyor",
    () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;
      const result =
        api.registerAdapter(
          createConnectAdapter()
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.changed,
        true
      );
      assert.equal(
        api.getStatus().available,
        true
      );
      assert.equal(
        api.getCapabilities()
          .includes(
            "calendar.write"
          ),
        true
      );
    }
  );

  await test(
    "Aynı Connect adaptörünün ikinci kaydı idempotent, farklı kayıt çakışmalıdır",
    () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;
      const adapter =
        createConnectAdapter();

      api.registerAdapter(adapter);
      const same =
        api.registerAdapter(adapter);
      const conflict =
        api.registerAdapter(
          createConnectAdapter({
            id:
              "another-connect"
          })
        );

      assert.equal(
        same.changed,
        false
      );
      assert.equal(
        conflict.errorCode,
        "TODAY-CONNECT-ADAPTER-002"
      );
    }
  );

  await test(
    "Connect sağlayıcısı yokken eylem hazırlama kontrollü sonuç dönüyor",
    async () => {
      const runtime = createRuntime();
      const result =
        await runtime.window
          .TodayConnect
          .prepareAction(
            connectRequest()
          );

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-003"
      );
    }
  );

  await test(
    "Açık veri kullanım onayı olmayan Connect isteği sağlayıcıya ulaşmıyor",
    async () => {
      let prepareCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare() {
            prepareCalls += 1;
            return {};
          }
        })
      );

      const result =
        await api.prepareAction(
          connectRequest({
            consent: {
              granted: false
            }
          })
        );

      assert.equal(
        prepareCalls,
        0
      );
      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-005"
      );
    }
  );

  await test(
    "Desteklenmeyen Connect yeteneği sağlayıcıya ulaşmıyor",
    async () => {
      let prepareCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare() {
            prepareCalls += 1;
            return {};
          }
        })
      );

      const result =
        await api.prepareAction(
          connectRequest({
            capability:
              "email.send"
          })
        );

      assert.equal(
        prepareCalls,
        0
      );
      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-006"
      );
    }
  );

  await test(
    "Connect hazırlama yalnız onay bekleyen güvenli eylem üretir",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter()
      );
      const result =
        await api.prepareAction(
          connectRequest()
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.action
          .requiresApproval,
        true
      );
      assert.equal(
        result.action.status,
        "pending"
      );
      assert.equal(
        api.getStatus()
          .pendingActionCount,
        1
      );
      assert.equal(
        Object.isFrozen(
          result.action
        ),
        true
      );
    }
  );

  await test(
    "Connect sağlayıcısı payloadın değişmez bir kopyasını alıyor",
    async () => {
      let received;
      const payload = {
        title: "Today",
        nested: {
          enabled: true
        }
      };
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare(request) {
            received = request;
            return {
              actionId:
                "copied-action",
              summary:
                request.summary,
              permissionScopes: [
                "calendar.write"
              ],
              requiresApproval:
                true,
              preview: {
                title:
                  request.payload.title
              }
            };
          }
        })
      );

      const result =
        await api.prepareAction(
          connectRequest({
            payload
          })
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        received.payload ===
          payload,
        false
      );
      assert.equal(
        Object.isFrozen(
          received.payload
        ),
        true
      );
      assert.equal(
        Object.isFrozen(
          received.payload.nested
        ),
        true
      );
      assert.equal(
        Object.isFrozen(
          result.action.preview
        ),
        true
      );
    }
  );

  await test(
    "Kaldırılan Connect adaptörünün geciken hazırlığı bekleyen eylem oluşturmuyor",
    async () => {
      let resolvePreparation;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          prepare() {
            return new Promise(resolve => {
              resolvePreparation =
                resolve;
            });
          }
        })
      );

      const preparation =
        api.prepareAction(
          connectRequest()
        );

      await Promise.resolve();
      api.unregisterAdapter(
        "today-connect-test"
      );
      resolvePreparation({
        actionId:
          "late-action",
        summary:
          "Geciken hazırlık",
        permissionScopes: [
          "calendar.write"
        ],
        requiresApproval: true
      });

      const result =
        await preparation;

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-020"
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );
    }
  );

  await test(
    "Connect sağlayıcısının hazırlama sırasında yazma metoduna erişimi yoktur",
    async () => {
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            executeCalls += 1;
          }
        })
      );

      await api.prepareAction(
        connectRequest()
      );

      assert.equal(
        executeCalls,
        0
      );
    }
  );

  await test(
    "Sağlayıcının requiresApproval işareti olmayan hazırlığı reddediliyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare() {
            return {
              actionId:
                "action-no-approval",
              summary:
                "Onaysız hazırlık",
              permissionScopes: [
                "calendar.write"
              ],
              requiresApproval:
                false
            };
          }
        })
      );

      const result =
        await api.prepareAction(
          connectRequest()
        );

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-007"
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );
    }
  );

  await test(
    "Aynı actionId ile ikinci Connect hazırlığı reddediliyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare(request) {
            return {
              actionId:
                "same-action",
              summary:
                request.summary,
              permissionScopes: [
                "calendar.write"
              ],
              requiresApproval:
                true
            };
          }
        })
      );

      const first =
        await api.prepareAction(
          connectRequest()
        );
      const second =
        await api.prepareAction(
          connectRequest({
            requestId:
              "request-connect-2"
          })
        );

      assert.equal(
        first.success,
        true
      );
      assert.equal(
        second.errorCode,
        "TODAY-CONNECT-ADAPTER-008"
      );
      assert.equal(
        api.getPendingActions()
          .length,
        1
      );
    }
  );

  await test(
    "Reddedilen veya eksik kullanıcı onayı execute çağırmıyor",
    async () => {
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            executeCalls += 1;
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          {
            actionId:
              prepared.action.actionId,
            approved: false
          }
        );

      assert.equal(
        executeCalls,
        0
      );
      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-011"
      );
      assert.equal(
        api.getPendingActions()
          .length,
        1
      );
    }
  );

  await test(
    "Onaydaki actionId hazırlanan eylemle birebir eşleşmelidir",
    async () => {
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            executeCalls += 1;
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            "another-action"
          )
        );

      assert.equal(
        executeCalls,
        0
      );
      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-011"
      );
    }
  );

  await test(
    "Geçerli açık onay eylemi bir kez çalıştırıp bekleyen kaydı kaldırıyor",
    async () => {
      let executeCalls = 0;
      let receivedApproval;
      let receivedPrepared;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute(
            prepared,
            approval
          ) {
            executeCalls += 1;
            receivedPrepared =
              prepared;
            receivedApproval =
              approval;
            return {
              success: true,
              actionId:
                prepared.actionId
            };
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        executeCalls,
        1
      );
      assert.equal(
        Object.isFrozen(
          receivedApproval
        ),
        true
      );
      assert.equal(
        Object.isFrozen(
          receivedPrepared
        ),
        true
      );
      assert.equal(
        Object.isFrozen(
          receivedPrepared.preview
        ),
        true
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );

      const second =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );

      assert.equal(
        second.errorCode,
        "TODAY-CONNECT-ADAPTER-010"
      );
      assert.equal(
        executeCalls,
        1
      );
    }
  );

  await test(
    "Aynı eylemin eşzamanlı ikinci onayı sağlayıcıya ulaşmıyor",
    async () => {
      let resolveExecution;
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          execute() {
            executeCalls += 1;
            return new Promise(resolve => {
              resolveExecution =
                resolve;
            });
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const approval =
        approvalFor(
          prepared.action.actionId
        );
      const first =
        api.approveAction(
          prepared.action.actionId,
          approval
        );

      await Promise.resolve();

      const second =
        await api.approveAction(
          prepared.action.actionId,
          approval
        );

      assert.equal(
        second.errorCode,
        "TODAY-CONNECT-ADAPTER-014"
      );
      assert.equal(
        executeCalls,
        1
      );

      resolveExecution({
        success: true
      });
      await first;
    }
  );

  await test(
    "Sağlayıcının başarısız execute sonucu eylemi yeniden onaylanabilir bırakıyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            return {
              success: false
            };
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-016"
      );
      assert.equal(
        api.getPendingActions()[0]
          .status,
        "pending"
      );
    }
  );

  await test(
    "Sağlayıcı execute hatası kişisel payloadı hata olayına taşımıyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            throw new Error(
              "execute failed"
            );
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest({
            payload: {
              privateTitle:
                "gizli-baslik"
            }
          })
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );
      const event =
        runtime.eventsOf(
          "today:connect-adapter-error"
        ).at(-1);

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-017"
      );
      assert.equal(
        JSON.stringify(
          event.detail
        ).includes(
          "gizli-baslik"
        ),
        false
      );
      assert.equal(
        api.getPendingActions()[0]
          .status,
        "pending"
      );
    }
  );

  await test(
    "Bekleyen Connect eylemi dış işlem yapılmadan iptal ediliyor",
    async () => {
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async execute() {
            executeCalls += 1;
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        api.cancelAction(
          prepared.action.actionId
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.changed,
        true
      );
      assert.equal(
        executeCalls,
        0
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );
    }
  );

  await test(
    "Çalışmakta olan Connect eylemi yerel iptalle belirsiz duruma düşürülmüyor",
    async () => {
      let resolveExecution;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          execute() {
            return new Promise(resolve => {
              resolveExecution =
                resolve;
            });
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const execution =
        api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );

      await Promise.resolve();

      const cancel =
        api.cancelAction(
          prepared.action.actionId
        );

      assert.equal(
        cancel.errorCode,
        "TODAY-CONNECT-ADAPTER-018"
      );

      const unregister =
        api.unregisterAdapter(
          "today-connect-test"
        );

      assert.equal(
        unregister.errorCode,
        "TODAY-CONNECT-ADAPTER-019"
      );
      assert.equal(
        api.getStatus().available,
        true
      );

      resolveExecution({
        success: true
      });
      await execution;
    }
  );

  await test(
    "Süresi geçmiş Connect hazırlığı execute edilmeden kaldırılıyor",
    async () => {
      let executeCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare(request) {
            return {
              actionId:
                "expired-action",
              summary:
                request.summary,
              permissionScopes: [
                "calendar.write"
              ],
              requiresApproval:
                true,
              expiresAt:
                "2020-01-01T00:00:00.000Z"
            };
          },
          async execute() {
            executeCalls += 1;
          }
        })
      );
      const prepared =
        await api.prepareAction(
          connectRequest()
        );
      const result =
        await api.approveAction(
          prepared.action.actionId,
          approvalFor(
            prepared.action.actionId
          )
        );

      assert.equal(
        result.errorCode,
        "TODAY-CONNECT-ADAPTER-015"
      );
      assert.equal(
        executeCalls,
        0
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );
    }
  );

  await test(
    "Connect adaptörü kaldırıldığında bekleyen onaylar bellekte bırakılmıyor",
    async () => {
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter()
      );
      await api.prepareAction(
        connectRequest()
      );

      const result =
        api.unregisterAdapter(
          "today-connect-test"
        );

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.clearedActions,
        1
      );
      assert.equal(
        api.getPendingActions()
          .length,
        0
      );
      assert.equal(
        api.getStatus().available,
        false
      );
    }
  );

  await test(
    "En fazla 20 bekleyen Connect hazırlığı tutuluyor",
    async () => {
      let sequence = 0;
      let prepareCalls = 0;
      const runtime = createRuntime();
      const api =
        runtime.window.TodayConnect;

      api.registerAdapter(
        createConnectAdapter({
          async prepare(request) {
            prepareCalls += 1;
            sequence += 1;
            return {
              actionId:
                `limited-${sequence}`,
              summary:
                request.summary,
              permissionScopes: [
                "calendar.write"
              ],
              requiresApproval:
                true
            };
          }
        })
      );

      for (
        let index = 1;
        index <= 20;
        index += 1
      ) {
        const result =
          await api.prepareAction(
            connectRequest({
              requestId:
                `request-limit-${index}`
            })
          );

        assert.equal(
          result.success,
          true
        );
      }

      const overflow =
        await api.prepareAction(
          connectRequest({
            requestId:
              "request-limit-21"
          })
        );

      assert.equal(
        overflow.errorCode,
        "TODAY-CONNECT-ADAPTER-004"
      );
      assert.equal(
        prepareCalls,
        20
      );
      assert.equal(
        api.getPendingActions()
          .length,
        20
      );
    }
  );

  await test(
    "Adaptör arayüzleri kalıcı kullanıcı alanı, UI veya doğrudan ağ API'si kullanmıyor",
    () => {
      [
        "localStorage",
        "sessionStorage",
        "today_app_v10",
        "today_store_v2",
        "today_store_v2_backup",
        "querySelector",
        "getElementById",
        "createElement",
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "navigator."
      ].forEach(text => {
        assert.equal(
          source.includes(text),
          false,
          text
        );
      });
    }
  );

  const failed = results.filter(
    result => !result.success
  );

  results.forEach(result => {
    const prefix =
      result.success
        ? "PASS"
        : "FAIL";
    const suffix =
      result.error
        ? ` — ${result.error}`
        : "";

    console.log(
      `${prefix}: ${result.name}${suffix}`
    );
  });

  console.log(
    `AI & Connect Adapter Interfaces: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
