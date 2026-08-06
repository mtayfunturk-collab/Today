const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  IDBFactory
} = require("fake-indexeddb");

const CONTRACT_PATH =
  "modules/nutrition-contracts.js";
const STORAGE_PATH =
  "modules/nutrition-storage.js";
const PROFILE_PATH =
  "modules/nutrition-profile.js";

const contractSource = fs.readFileSync(
  CONTRACT_PATH,
  "utf8"
);
const storageSource = fs.readFileSync(
  STORAGE_PATH,
  "utf8"
);
const profileSource = fs.readFileSync(
  PROFILE_PATH,
  "utf8"
);

const T1 = "2026-08-05T10:00:00.000Z";
const T2 = "2026-08-05T11:00:00.000Z";
const T3 = "2026-08-05T12:00:00.000Z";
const T4 = "2026-08-05T13:00:00.000Z";

function createRuntime(options = {}) {
  let uuidCounter = 0;
  const window = {
    indexedDB: new IDBFactory(),
    structuredClone:
      globalThis.structuredClone,
    crypto: {
      randomUUID() {
        uuidCounter += 1;
        return [
          "00000000",
          "0000",
          "4000",
          "8000",
          String(uuidCounter)
            .padStart(12, "0")
        ].join("-");
      }
    }
  };
  const context = {
    window,
    console
  };

  if (options.loadContracts !== false) {
    vm.runInNewContext(
      contractSource,
      context,
      { filename: CONTRACT_PATH }
    );
  }

  if (options.loadStorage !== false) {
    vm.runInNewContext(
      storageSource,
      context,
      { filename: STORAGE_PATH }
    );
  }

  vm.runInNewContext(
    profileSource,
    context,
    { filename: PROFILE_PATH }
  );

  return {
    window,
    contracts:
      window.TodayNutritionContracts,
    storage:
      window.TodayNutritionStorage,
    api:
      window.TodayNutritionProfile
  };
}

function confirmed(at = T1) {
  return {
    userInitiated: true,
    userConfirmed: true,
    at
  };
}

function aiApproved(at = T2) {
  return {
    userRequested: true,
    userDataUseApproved: true,
    at
  };
}

function known(value, unit) {
  return {
    status: "known",
    value,
    unit,
    basis: null
  };
}

function unknown(unit) {
  return {
    status: "unknown",
    value: null,
    unit,
    basis: null
  };
}

function awareness(
  effectiveFrom = "2026-08-05"
) {
  return {
    goalKind: "awareness",
    effectiveFrom,
    targets: {}
  };
}

function maintenance(
  effectiveFrom = "2026-08-06"
) {
  return {
    goalKind: "maintenance",
    effectiveFrom,
    targets: {
      energy_kcal:
        known(2000, "kcal")
    }
  };
}

function aiGoal(
  effectiveFrom = "2026-08-06"
) {
  return {
    ...maintenance(effectiveFrom),
    aiSource: {
      referenceId:
        "today-ai-engine",
      version: "1.0.0"
    }
  };
}

function baseRecord(
  contracts,
  type,
  id,
  payload,
  overrides = {}
) {
  return contracts.createRecord({
    id,
    type,
    schemaVersion: 1,
    createdAt: T1,
    updatedAt: T2,
    eventAt: null,
    source: {
      kind: "manual",
      referenceId: null,
      version: null
    },
    knowledgeStatus: "known",
    recordStatus: "active",
    verificationStatus:
      "user_confirmed",
    calculationVersion: null,
    userEdited: false,
    payload,
    extensions: {},
    ...overrides
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function close(runtime) {
  if (runtime.storage) {
    runtime.storage.close();
  }
}

async function expectCode(
  promise,
  code
) {
  await assert.rejects(
    promise,
    error => {
      assert.equal(
        error.todayCode,
        code
      );
      return true;
    }
  );
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "Profil API'si v1 kimliğiyle değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.PROFILE_API_VERSION,
      1
    );
    assert.equal(
      runtime.api.PROFILE_RULESET_ID,
      "today:nutrition:profile:v1"
    );
    assert.equal(
      Object.isFrozen(runtime.api),
      true
    );
    await close(runtime);
  }
);

test(
  "Ana profil kimliği ve sade varsayılanı sabit",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.PROFILE_RECORD_ID,
      "nutrition-profile:main"
    );
    assert.equal(
      runtime.api.DEFAULT_TRACKING_MODE,
      "simple"
    );
    await close(runtime);
  }
);

test(
  "Kayıt modları sade, ayrıntılı ve uzman düzenini ayırıyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.TRACKING_MODES],
      [
        "simple",
        "detailed",
        "professional"
      ]
    );
    assert.equal(
      Object.isFrozen(
        runtime.api.TRACKING_MODES
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "Yedi kısıt kategorisi alerji, intolerans ve tercihleri karıştırmıyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.CONSTRAINT_CATEGORIES],
      [
        "allergy",
        "intolerance",
        "ethical_preference",
        "personal_preference",
        "religious",
        "medical",
        "other"
      ]
    );
    await close(runtime);
  }
);

test(
  "Onaylı yedi hedef türü değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.GOAL_KINDS],
      [
        "awareness",
        "maintenance",
        "weight_loss",
        "weight_gain",
        "muscle_gain",
        "performance",
        "professional_other"
      ]
    );
    await close(runtime);
  }
);

test(
  "Profil modülü UI, ağ, Core deposu ve hesaplama motoruna bağlanmıyor",
  async () => {
    [
      "document.",
      "fetch(",
      "XMLHttpRequest",
      ".localStorage",
      "today_store_v2",
      "TodayNutritionCalculations",
      ".deleteRecord("
    ].forEach(forbidden => {
      assert.equal(
        profileSource.includes(forbidden),
        false,
        forbidden
      );
    });
  }
);

test(
  "Modül yüklenirken IndexedDB oluşturulmuyor",
  async () => {
    const runtime = createRuntime();
    const databases =
      await runtime.window.indexedDB
        .databases();
    assert.deepEqual(databases, []);
    await close(runtime);
  }
);

test(
  "Eksik sözleşme bağımlılığı açık hata koduyla duruyor",
  async () => {
    const runtime = createRuntime({
      loadContracts: false,
      loadStorage: false
    });
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-001"
    );
  }
);

test(
  "Eksik storage API üyesi tam bağımlılık hatasına dönüşüyor",
  async () => {
    const runtime = createRuntime({
      loadStorage: false
    });
    runtime.window.TodayNutritionStorage = {
      getRecord() {},
      queryRecords() {},
      saveRecord() {}
    };
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-001"
    );
  }
);

test(
  "Profil oluşturma kullanıcı başlatması olmadan reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createProfile(
        {},
        {
          userConfirmed: true,
          at: T1
        }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    await close(runtime);
  }
);

test(
  "Profil oluşturma açık kullanıcı onayı olmadan reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createProfile(
        {},
        {
          userInitiated: true,
          at: T1
        }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    await close(runtime);
  }
);

test(
  "İlk profil yalnız açık işlemle sade modda oluşuyor",
  async () => {
    const runtime = createRuntime();
    const snapshot =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    assert.equal(
      snapshot.trackingMode,
      "simple"
    );
    assert.equal(
      snapshot.profile.id,
      runtime.api.PROFILE_RECORD_ID
    );
    assert.equal(
      snapshot.profile.source.kind,
      "manual"
    );
    assert.equal(
      snapshot.profile
        .verificationStatus,
      "user_confirmed"
    );
    await close(runtime);
  }
);

test(
  "İlk profil hedef ve kısıt olmadan da açık durumu koruyor",
  async () => {
    const runtime = createRuntime();
    const snapshot =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    assert.deepEqual(
      snapshot.activeConstraints,
      []
    );
    assert.equal(
      snapshot.primaryGoal,
      null
    );
    assert.deepEqual(
      snapshot.goalHistory,
      []
    );
    await close(runtime);
  }
);

[
  "detailed",
  "professional"
].forEach(mode => {
  test(
    `İlk profil ${mode} modunu yalnız açık seçimle saklıyor`,
    async () => {
      const runtime = createRuntime();
      const snapshot =
        await runtime.api.createProfile(
          { trackingMode: mode },
          confirmed()
        );
      assert.equal(
        snapshot.trackingMode,
        mode
      );
      await close(runtime);
    }
  );
});

test(
  "Geçersiz kayıt modu atomik profil kurulumunu durduruyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createProfile(
        null,
        confirmed()
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    await expectCode(
      runtime.api.createProfile(
        { trackingMode: "score" },
        confirmed()
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(snapshot.profile, null);
    await close(runtime);
  }
);

test(
  "İlk kısıtlar profil referanslarıyla aynı atomik işlemde oluşuyor",
  async () => {
    const runtime = createRuntime();
    const snapshot =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Yer fıstığı"
            },
            {
              category:
                "personal_preference",
              label: "Kırmızı eti sınırlamak"
            }
          ]
        },
        confirmed()
      );
    assert.equal(
      snapshot.activeConstraints.length,
      2
    );
    assert.deepEqual(
      snapshot.profile.payload
        .dietaryConstraintIds,
      snapshot.activeConstraints.map(
        item => item.id
      )
    );
    await close(runtime);
  }
);

test(
  "İlk ana hedef profil referansıyla birlikte oluşuyor",
  async () => {
    const runtime = createRuntime();
    const snapshot =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    assert.equal(
      snapshot.primaryGoal
        .payload.goalKind,
      "awareness"
    );
    assert.equal(
      snapshot.profile.payload
        .primaryGoalVersionId,
      snapshot.primaryGoal.id
    );
    await close(runtime);
  }
);

test(
  "Geçersiz ilk kısıt kısmi kayıt bırakmıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            },
            {
              category: "intolerance",
              label: "   "
            }
          ]
        },
        confirmed()
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    const status =
      await runtime.storage.getStatus();
    assert.equal(status.recordCount, 0);
    await close(runtime);
  }
);

test(
  "İlk kurulum aynı kategori ve etiketi yinelenmiş kabul etmiyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createProfile(
        {
          constraints: [
            {
              category: "intolerance",
              label: "Gluten"
            },
            {
              category: "intolerance",
              label: "gluten"
            }
          ]
        },
        confirmed()
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "İkinci kullanıcı profili oluşturulamıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.createProfile(
        {},
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "Profil anlık görüntüsü derin değişmez dönüyor",
  async () => {
    const runtime = createRuntime();
    const snapshot =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            }
          ]
        },
        confirmed()
      );
    assert.equal(
      Object.isFrozen(snapshot),
      true
    );
    assert.equal(
      Object.isFrozen(snapshot.profile),
      true
    );
    assert.equal(
      Object.isFrozen(
        snapshot.activeConstraints[0]
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "Anlık görüntü sonraki depo değişikliğinden etkilenmiyor",
  async () => {
    const runtime = createRuntime();
    const before =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    await runtime.api.addConstraint(
      {
        category: "allergy",
        label: "Fıstık"
      },
      confirmed(T2)
    );
    assert.equal(
      before.activeConstraints.length,
      0
    );
    await close(runtime);
  }
);

test(
  "Kayıt modu kullanıcı onayıyla ayrıntılıya geçiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.setTrackingMode(
        "detailed",
        confirmed(T2)
      );
    assert.equal(
      snapshot.trackingMode,
      "detailed"
    );
    assert.equal(
      snapshot.profile.userEdited,
      true
    );
    await close(runtime);
  }
);

test(
  "Aynı kayıt modu yinelenirse profil gereksiz yazılmıyor",
  async () => {
    const runtime = createRuntime();
    const before =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    const after =
      await runtime.api.setTrackingMode(
        "simple",
        confirmed(T2)
      );
    assert.equal(
      after.profile.updatedAt,
      before.profile.updatedAt
    );
    await close(runtime);
  }
);

test(
  "Kayıt modu onaysız değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.setTrackingMode(
        "detailed",
        { at: T2 }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    await close(runtime);
  }
);

test(
  "Geçersiz ve geçmiş işlem zamanı mevcut profili değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const before =
      await runtime.api.createProfile(
        {},
        confirmed(T2)
      );
    await expectCode(
      runtime.api.setTrackingMode(
        "detailed",
        confirmed(T1)
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    const after =
      await runtime.api.getSnapshot();
    assert.equal(
      after.profile.updatedAt,
      before.profile.updatedAt
    );
    await close(runtime);
  }
);

const categoryCases = [
  ["allergy", "allergy"],
  ["intolerance", "intolerance"],
  ["ethical_preference", "preference"],
  ["personal_preference", "preference"],
  ["religious", "religious"],
  ["medical", "medical"],
  ["other", "other"]
];

categoryCases.forEach(
  ([category, contractKind]) => {
    test(
      `${category} kategorisi ayrı kimliği ve doğru sözleşme türünü koruyor`,
      async () => {
        const runtime = createRuntime();
        await runtime.api.createProfile(
          {},
          confirmed()
        );
        const snapshot =
          await runtime.api.addConstraint(
            {
              category,
              label: `Kısıt ${category}`
            },
            confirmed(T2)
          );
        const item =
          snapshot.activeConstraints[0];
        assert.equal(
          item.category,
          category
        );
        assert.equal(
          item.record.payload.kind,
          contractKind
        );
        assert.equal(
          item.needsClassification,
          false
        );
        await close(runtime);
      }
    );
  }
);

test(
  "Etik ve kişisel tercih aynı etiketle dahi ayrı kalıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await runtime.api.addConstraint(
      {
        category: "ethical_preference",
        label: "Et tüketmemek"
      },
      confirmed(T2)
    );
    const snapshot =
      await runtime.api.addConstraint(
        {
          category: "personal_preference",
          label: "Et tüketmemek"
        },
        confirmed(T3)
      );
    assert.deepEqual(
      snapshot.activeConstraints.map(
        item => item.category
      ),
      [
        "ethical_preference",
        "personal_preference"
      ]
    );
    await close(runtime);
  }
);

test(
  "Aynı etkin kategori ve etiket büyük-küçük harfle yinelenemiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await runtime.api.addConstraint(
      {
        category: "intolerance",
        label: "Gluten"
      },
      confirmed(T2)
    );
    await expectCode(
      runtime.api.addConstraint(
        {
          category: "intolerance",
          label: "gluten"
        },
        confirmed(T3)
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "Kısıt etiketi yalnız kenar boşlukları temizlenerek saklanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.addConstraint(
        {
          category: "allergy",
          label: "  Yer fıstığı  "
        },
        confirmed(T2)
      );
    assert.equal(
      snapshot.activeConstraints[0]
        .label,
      "Yer fıstığı"
    );
    await close(runtime);
  }
);

test(
  "Yeni kısıt ve profil referansı atomik olarak ekleniyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T2)
      );
    assert.deepEqual(
      snapshot.profile.payload
        .dietaryConstraintIds,
      [snapshot.activeConstraints[0].id]
    );
    assert.equal(
      (
        await runtime.storage.getRecord(
          snapshot.activeConstraints[0].id
        )
      ).payload.active,
      true
    );
    await close(runtime);
  }
);

test(
  "Geçersiz kategori profil referansını değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.addConstraint(
        {
          category: "diet_score",
          label: "Test"
        },
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-008"
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.activeConstraints.length,
      0
    );
    await close(runtime);
  }
);

test(
  "Kısıt açık kullanıcı onayı olmadan eklenmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        { at: T2 }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    await close(runtime);
  }
);

test(
  "Kısıt değişikliği eski kaydı silmeyip arşivliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const added =
      await runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T2)
      );
    const oldId =
      added.activeConstraints[0].id;
    const replaced =
      await runtime.api.replaceConstraint(
        oldId,
        {
          category: "allergy",
          label: "Yer fıstığı"
        },
        confirmed(T3)
      );
    const oldRecord =
      await runtime.storage.getRecord(oldId);
    assert.equal(
      oldRecord.recordStatus,
      "archived"
    );
    assert.equal(
      oldRecord.payload.active,
      false
    );
    assert.notEqual(
      replaced.activeConstraints[0].id,
      oldId
    );
    await close(runtime);
  }
);

test(
  "Kısıt değişikliği profil sırasındaki referansı yerinde değiştiriyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            },
            {
              category: "intolerance",
              label: "Laktoz"
            }
          ]
        },
        confirmed()
      );
    const firstId =
      initial.activeConstraints[0].id;
    const secondId =
      initial.activeConstraints[1].id;
    const replaced =
      await runtime.api.replaceConstraint(
        firstId,
        {
          category: "allergy",
          label: "Yer fıstığı"
        },
        confirmed(T2)
      );
    assert.equal(
      replaced.activeConstraints[1].id,
      secondId
    );
    assert.equal(
      replaced.activeConstraints[0]
        .label,
      "Yer fıstığı"
    );
    await close(runtime);
  }
);

test(
  "Kısıt sürümlemesi eski kaydın oluşturulma zamanını koruyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            }
          ]
        },
        confirmed()
      );
    const old =
      initial.activeConstraints[0]
        .record;
    await runtime.api.replaceConstraint(
      old.id,
      {
        category: "allergy",
        label: "Yer fıstığı"
      },
      confirmed(T2)
    );
    const archived =
      await runtime.storage.getRecord(old.id);
    assert.equal(
      archived.createdAt,
      old.createdAt
    );
    assert.equal(archived.updatedAt, T2);
    await close(runtime);
  }
);

test(
  "Aynı kısıt içeriği gereksiz yeni sürüm oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            }
          ]
        },
        confirmed()
      );
    await expectCode(
      runtime.api.replaceConstraint(
        initial.activeConstraints[0].id,
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "Etkin kısıt kaldırıldığında kayıt silinmeden arşive taşınıyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            }
          ]
        },
        confirmed()
      );
    const id =
      initial.activeConstraints[0].id;
    const snapshot =
      await runtime.api
        .deactivateConstraint(
          id,
          confirmed(T2)
        );
    assert.equal(
      snapshot.activeConstraints.length,
      0
    );
    assert.equal(
      snapshot.constraintHistory.length,
      1
    );
    assert.equal(
      snapshot.constraintHistory[0]
        .record.recordStatus,
      "archived"
    );
    await close(runtime);
  }
);

test(
  "Bilinmeyen veya arşivli kısıt ikinci kez kaldırılamıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.deactivateConstraint(
        "dietary-constraint:missing",
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-006"
    );
    await close(runtime);
  }
);

test(
  "Kısıt arşivleme kullanıcı onayı olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          constraints: [
            {
              category: "allergy",
              label: "Fıstık"
            }
          ]
        },
        confirmed()
      );
    await expectCode(
      runtime.api.deactivateConstraint(
        initial.activeConstraints[0].id,
        { at: T2 }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    await close(runtime);
  }
);

test(
  "Eski v1 preference kaydı sessizce etik veya kişisel sayılmıyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    const legacy = baseRecord(
      runtime.contracts,
      "dietary_constraint",
      "dietary-constraint:legacy",
      {
        kind: "preference",
        label: "Eski tercih",
        active: true
      }
    );
    const profile = baseRecord(
      runtime.contracts,
      "nutrition_profile",
      initial.profile.id,
      {
        ...clone(initial.profile.payload),
        dietaryConstraintIds: [
          legacy.id
        ]
      },
      {
        createdAt:
          initial.profile.createdAt,
        updatedAt: T2,
        userEdited: true
      }
    );
    await runtime.storage.saveRecords(
      [legacy, profile]
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.activeConstraints[0]
        .category,
      "preference_unspecified"
    );
    assert.equal(
      snapshot.activeConstraints[0]
        .needsClassification,
      true
    );
    await close(runtime);
  }
);

test(
  "Kısıt uzantısı sözleşme türüyle çelişirse profil güvenli biçimde duruyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    const invalidSemantic = baseRecord(
      runtime.contracts,
      "dietary_constraint",
      "dietary-constraint:mismatch",
      {
        kind: "allergy",
        label: "Çelişki",
        active: true
      },
      {
        extensions: {
          "today.nutrition.constraint": {
            category:
              "personal_preference"
          }
        }
      }
    );
    const profile = baseRecord(
      runtime.contracts,
      "nutrition_profile",
      initial.profile.id,
      {
        ...clone(initial.profile.payload),
        dietaryConstraintIds: [
          invalidSemantic.id
        ]
      },
      {
        createdAt:
          initial.profile.createdAt,
        updatedAt: T2,
        userEdited: true
      }
    );
    await runtime.storage.saveRecords(
      [invalidSemantic, profile]
    );
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Farkındalık hedefi sayısal hedef olmadan etkinleşebiliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.createGoalVersion(
        awareness(),
        confirmed(T2)
      );
    assert.equal(
      snapshot.primaryGoal
        .payload.goalKind,
      "awareness"
    );
    assert.deepEqual(
      snapshot.primaryGoal
        .payload.targets,
      {}
    );
    await close(runtime);
  }
);

test(
  "Farkındalık dışı hedef boş ölçüm haritasıyla etkinleşmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.createGoalVersion(
        {
          goalKind: "maintenance",
          effectiveFrom:
            "2026-08-06",
          targets: {}
        },
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.primaryGoal,
      null
    );
    await close(runtime);
  }
);

test(
  "Hedefte bilinmeyen değer sıfıra çevrilmeden korunuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.createGoalVersion(
        {
          goalKind: "maintenance",
          effectiveFrom:
            "2026-08-06",
          targets: {
            energy_kcal:
              unknown("kcal")
          }
        },
        confirmed(T2)
      );
    assert.equal(
      snapshot.primaryGoal.payload
        .targets.energy_kcal.value,
      null
    );
    await close(runtime);
  }
);

test(
  "İlk hedef etkinleştiğinde profil aynı sürüme bağlanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const snapshot =
      await runtime.api.createGoalVersion(
        awareness(),
        confirmed(T2)
      );
    assert.equal(
      snapshot.profile.payload
        .primaryGoalVersionId,
      snapshot.primaryGoal.id
    );
    assert.equal(
      snapshot.primaryGoal.recordStatus,
      "active"
    );
    assert.equal(
      snapshot.goalHistory.length,
      1
    );
    await close(runtime);
  }
);

test(
  "Yeni hedef sürümü eski hedefi aynı atomik işlemde superseded yapıyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    const oldId = initial.primaryGoal.id;
    const snapshot =
      await runtime.api.createGoalVersion(
        maintenance(),
        confirmed(T2)
      );
    const oldRecord =
      await runtime.storage.getRecord(oldId);
    assert.equal(
      oldRecord.recordStatus,
      "superseded"
    );
    assert.equal(
      snapshot.primaryGoal.payload
        .supersedesId,
      oldId
    );
    assert.equal(
      snapshot.goalHistory.length,
      2
    );
    await close(runtime);
  }
);

test(
  "Hedef geçmişi güncelden eskiye zincir sırasını koruyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness(
          "2026-08-05"
        )
      },
      confirmed()
    );
    const second =
      await runtime.api.createGoalVersion(
        maintenance("2026-08-06"),
        confirmed(T2)
      );
    const third =
      await runtime.api.createGoalVersion(
        {
          goalKind: "performance",
          effectiveFrom:
            "2026-08-07",
          targets: {
            protein_g: known(120, "g")
          }
        },
        confirmed(T3)
      );
    assert.deepEqual(
      third.goalHistory.map(
        goal => goal.payload.goalKind
      ),
      [
        "performance",
        "maintenance",
        "awareness"
      ]
    );
    assert.equal(
      third.goalHistory[0]
        .payload.supersedesId,
      second.primaryGoal.id
    );
    await close(runtime);
  }
);

test(
  "Yeni hedef geçmiş hedef başlangıcından önceye alınamıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness(
          "2026-08-10"
        )
      },
      confirmed()
    );
    await expectCode(
      runtime.api.createGoalVersion(
        maintenance("2026-08-09"),
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-009"
    );
    await close(runtime);
  }
);

test(
  "Aynı hedef içeriği gereksiz yeni sürüm oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness()
      },
      confirmed()
    );
    await expectCode(
      runtime.api.createGoalVersion(
        awareness(),
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "Ana hedef kullanıcı onayı olmadan değişmiyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    await expectCode(
      runtime.api.createGoalVersion(
        maintenance(),
        { at: T2 }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    const current =
      await runtime.api.getSnapshot();
    assert.equal(
      current.primaryGoal.id,
      initial.primaryGoal.id
    );
    await close(runtime);
  }
);

test(
  "Her hedef geçişinden sonra yalnız bir etkin hedef kalıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness()
      },
      confirmed()
    );
    await runtime.api.createGoalVersion(
      maintenance(),
      confirmed(T2)
    );
    const goals =
      await runtime.storage.queryRecords({
        types: [
          "nutrition_goal_version"
        ],
        includeAiDrafts: true
      });
    assert.equal(
      goals.filter(
        goal =>
          goal.recordStatus === "active"
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "Profil değişikliği geçmiş öğün ve hesap kayıtlarını değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const item = baseRecord(
      runtime.contracts,
      "meal_item_snapshot",
      "meal-item:historic",
      {
        itemKind: "custom",
        referenceId: null,
        name: "Tarihsel öğün",
        amount: known(1, "portion"),
        nutrients: {
          energy_kcal:
            unknown("kcal")
        },
        sourceVersion: null
      }
    );
    const meal = baseRecord(
      runtime.contracts,
      "meal_entry",
      "meal-entry:historic",
      {
        consumedAt: T1,
        mealType: "lunch",
        itemSnapshotIds: [item.id],
        coverage: "complete",
        plannedMealId: null
      },
      { eventAt: T1 }
    );
    const summary = baseRecord(
      runtime.contracts,
      "nutrition_summary",
      "nutrition-summary:historic",
      {
        period: {
          startDate: "2026-08-05",
          endDate: "2026-08-05"
        },
        usedRecordIds: [meal.id],
        coverage: {
          status: "complete",
          comparableRecordCount: 1,
          totalRecordCount: 1,
          missingRecordCount: 0,
          userDeclared: true
        },
        metrics: {
          energy_kcal:
            unknown("kcal")
        }
      },
      {
        source: {
          kind: "system_calculation",
          referenceId:
            "today-nutrition-engine",
          version: "1.0.0"
        },
        verificationStatus:
          "source_verified",
        calculationVersion:
          "nutrition-calc-v1"
      }
    );
    await runtime.storage.saveRecords([
      item,
      meal,
      summary
    ]);
    const before = await Promise.all(
      [item.id, meal.id, summary.id]
        .map(id =>
          runtime.storage.getRecord(id)
        )
    );
    await runtime.api.createGoalVersion(
      awareness(),
      confirmed(T3)
    );
    const after = await Promise.all(
      [item.id, meal.id, summary.id]
        .map(id =>
          runtime.storage.getRecord(id)
        )
    );
    assert.deepEqual(after, before);
    await close(runtime);
  }
);

test(
  "AI hedef taslağı kullanıcı isteği olmadan kaydedilmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.saveGoalDraft(
        aiGoal(),
        {
          userDataUseApproved: true,
          at: T2
        }
      ),
      "TODAY-NUTRITION-PROFILE-007"
    );
    await close(runtime);
  }
);

test(
  "AI hedef taslağı veri kullanım onayı olmadan kaydedilmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.saveGoalDraft(
        aiGoal(),
        {
          userRequested: true,
          at: T2
        }
      ),
      "TODAY-NUTRITION-PROFILE-007"
    );
    await close(runtime);
  }
);

test(
  "AI hedef taslağı sürümlü kaynak kimliği taşıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    assert.equal(
      draft.source.kind,
      "ai_draft"
    );
    assert.equal(
      draft.source.referenceId,
      "today-ai-engine"
    );
    assert.equal(
      draft.source.version,
      "1.0.0"
    );
    await close(runtime);
  }
);

test(
  "AI hedef taslağı tahmini, doğrulanmamış ve etkin olmayan kalıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    assert.equal(
      draft.knowledgeStatus,
      "estimated"
    );
    assert.equal(
      draft.recordStatus,
      "draft"
    );
    assert.equal(
      draft.verificationStatus,
      "unverified"
    );
    assert.equal(draft.userEdited, false);
    await close(runtime);
  }
);

test(
  "AI hedef taslağı profili veya etkin hedefi değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const before =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    await runtime.api.saveGoalDraft(
      aiGoal(),
      aiApproved()
    );
    const after =
      await runtime.api.getSnapshot();
    assert.equal(
      after.primaryGoal.id,
      before.primaryGoal.id
    );
    assert.equal(
      after.profile.updatedAt,
      before.profile.updatedAt
    );
    await close(runtime);
  }
);

test(
  "AI hedef taslağı varsayılan etkin geçmişe karışmıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness()
      },
      confirmed()
    );
    await runtime.api.saveGoalDraft(
      aiGoal(),
      aiApproved()
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.goalHistory.length,
      1
    );
    assert.equal(
      (
        await runtime.api
          .listGoalDrafts()
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "Geçersiz AI kaynak kimliği taslak yazımını durduruyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.saveGoalDraft(
        {
          ...maintenance(),
          aiSource: {
            referenceId: "AI SOURCE!",
            version: "1.0.0"
          }
        },
        aiApproved()
      ),
      "TODAY-NUTRITION-PROFILE-002"
    );
    await close(runtime);
  }
);

test(
  "AI hedef taslağı açık kullanıcı onayı olmadan etkinleşmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    await expectCode(
      runtime.api.acceptGoalDraft(
        draft.id,
        { at: T3 }
      ),
      "TODAY-NUTRITION-PROFILE-003"
    );
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.primaryGoal,
      null
    );
    await close(runtime);
  }
);

test(
  "Onaylanan AI taslağı yeni manuel kullanıcı hedefi oluşturuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    const snapshot =
      await runtime.api.acceptGoalDraft(
        draft.id,
        confirmed(T3)
      );
    assert.notEqual(
      snapshot.primaryGoal.id,
      draft.id
    );
    assert.equal(
      snapshot.primaryGoal.source.kind,
      "manual"
    );
    assert.equal(
      snapshot.primaryGoal
        .verificationStatus,
      "user_confirmed"
    );
    await close(runtime);
  }
);

test(
  "Onaylanan hedef kaynak AI taslağına izlenebilir biçimde bağlanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    const snapshot =
      await runtime.api.acceptGoalDraft(
        draft.id,
        confirmed(T3)
      );
    assert.equal(
      snapshot.primaryGoal.extensions[
        "today.nutrition.approval"
      ].sourceDraftId,
      draft.id
    );
    assert.equal(
      snapshot.primaryGoal.extensions[
        "today.nutrition.approval"
      ].confirmedAt,
      T3
    );
    await close(runtime);
  }
);

test(
  "AI taslağı kabul edilince önceki ana hedef superseded oluyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    const snapshot =
      await runtime.api.acceptGoalDraft(
        draft.id,
        confirmed(T3)
      );
    assert.equal(
      (
        await runtime.storage.getRecord(
          initial.primaryGoal.id
        )
      ).recordStatus,
      "superseded"
    );
    assert.equal(
      snapshot.primaryGoal.payload
        .supersedesId,
      initial.primaryGoal.id
    );
    await close(runtime);
  }
);

test(
  "Kabul edilen AI kaydı taslak olarak değişmeden kalıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    await runtime.api.acceptGoalDraft(
      draft.id,
      confirmed(T3)
    );
    const storedDraft =
      await runtime.storage.getRecord(
        draft.id,
        { includeAiDraft: true }
      );
    assert.deepEqual(storedDraft, draft);
    assert.equal(
      (
        await runtime.api
          .listGoalDrafts()
      ).length,
      0
    );
    const included =
      await runtime.api.listGoalDrafts({
        includeAccepted: true
      });
    assert.equal(included[0].accepted, true);
    await close(runtime);
  }
);

test(
  "Güncel hedef değiştiyse eski AI taslağı sessizce etkinleşmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness()
      },
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    await runtime.api.createGoalVersion(
      {
        goalKind: "performance",
        effectiveFrom:
          "2026-08-06",
        targets: {
          protein_g: known(120, "g")
        }
      },
      confirmed(T3)
    );
    await expectCode(
      runtime.api.acceptGoalDraft(
        draft.id,
        confirmed(T4)
      ),
      "TODAY-NUTRITION-PROFILE-010"
    );
    await close(runtime);
  }
);

test(
  "Aynı AI taslağı iki kez kullanıcı hedefi yapılamıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const draft =
      await runtime.api.saveGoalDraft(
        aiGoal(),
        aiApproved()
      );
    await runtime.api.acceptGoalDraft(
      draft.id,
      confirmed(T3)
    );
    await expectCode(
      runtime.api.acceptGoalDraft(
        draft.id,
        confirmed(T4)
      ),
      "TODAY-NUTRITION-PROFILE-004"
    );
    await close(runtime);
  }
);

test(
  "Profilce referans verilmeyen etkin kısıt tutarsız durum olarak yakalanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const orphan = baseRecord(
      runtime.contracts,
      "dietary_constraint",
      "dietary-constraint:orphan",
      {
        kind: "allergy",
        label: "Yetim kısıt",
        active: true
      }
    );
    await runtime.storage.saveRecord(orphan);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Profil superseded hedefe işaret ederse güvenli biçimde duruyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {},
        confirmed()
      );
    const goal = baseRecord(
      runtime.contracts,
      "nutrition_goal_version",
      "nutrition-goal:old",
      {
        goalKind: "awareness",
        effectiveFrom: "2026-08-05",
        supersedesId: null,
        targets: {}
      },
      { recordStatus: "superseded" }
    );
    const profile = baseRecord(
      runtime.contracts,
      "nutrition_profile",
      initial.profile.id,
      {
        ...clone(initial.profile.payload),
        primaryGoalVersionId: goal.id
      },
      {
        createdAt:
          initial.profile.createdAt,
        updatedAt: T2,
        userEdited: true
      }
    );
    await runtime.storage.saveRecords([
      goal,
      profile
    ]);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Birden fazla etkin profil yüksek seviye kapıda reddediliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const second = baseRecord(
      runtime.contracts,
      "nutrition_profile",
      "nutrition-profile:second",
      {
        trackingMode: "simple",
        dietaryConstraintIds: [],
        primaryGoalVersionId: null
      }
    );
    await runtime.storage.saveRecord(second);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Hedef geçmişindeki döngü yüksek seviye kapıda reddediliyor",
  async () => {
    const runtime = createRuntime();
    const initial =
      await runtime.api.createProfile(
        {
          primaryGoal: awareness()
        },
        confirmed()
      );
    const current = clone(
      initial.primaryGoal
    );
    const previous = baseRecord(
      runtime.contracts,
      "nutrition_goal_version",
      "nutrition-goal:cycle",
      {
        goalKind: "awareness",
        effectiveFrom: "2026-08-05",
        supersedesId: current.id,
        targets: {}
      },
      { recordStatus: "superseded" }
    );
    current.payload.supersedesId =
      previous.id;
    current.updatedAt = T2;
    await runtime.storage.saveRecords([
      current,
      previous
    ]);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Ana zincire bağlı olmayan superseded hedef reddediliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {
        primaryGoal: awareness()
      },
      confirmed()
    );
    const orphan = baseRecord(
      runtime.contracts,
      "nutrition_goal_version",
      "nutrition-goal:orphan",
      {
        goalKind: "awareness",
        effectiveFrom: "2026-08-05",
        supersedesId: null,
        targets: {}
      },
      { recordStatus: "superseded" }
    );
    await runtime.storage.saveRecord(orphan);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PROFILE-005"
    );
    await close(runtime);
  }
);

test(
  "Eşzamanlı profil komutları tek sekmede sıraya alınıp ikisi de korunuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await Promise.all([
      runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T2)
      ),
      runtime.api.addConstraint(
        {
          category: "intolerance",
          label: "Laktoz"
        },
        confirmed(T2)
      )
    ]);
    const snapshot =
      await runtime.api.getSnapshot();
    assert.equal(
      snapshot.activeConstraints.length,
      2
    );
    await close(runtime);
  }
);

test(
  "Başarısız komut sonraki geçerli profil komutunu zehirlemiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    await expectCode(
      runtime.api.addConstraint(
        {
          category: "invalid",
          label: "Hata"
        },
        confirmed(T2)
      ),
      "TODAY-NUTRITION-PROFILE-008"
    );
    const snapshot =
      await runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T3)
      );
    assert.equal(
      snapshot.activeConstraints.length,
      1
    );
    await close(runtime);
  }
);

test(
  "Profil komutlarının bütün sonuçları dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.createProfile(
      {},
      confirmed()
    );
    const constraintResult =
      await runtime.api.addConstraint(
        {
          category: "allergy",
          label: "Fıstık"
        },
        confirmed(T2)
      );
    const goalResult =
      await runtime.api.createGoalVersion(
        awareness(),
        confirmed(T3)
      );
    assert.equal(
      Object.isFrozen(
        constraintResult
          .activeConstraints[0].record
      ),
      true
    );
    assert.equal(
      Object.isFrozen(
        goalResult.primaryGoal.payload
      ),
      true
    );
    await close(runtime);
  }
);

(async () => {
  const results = [];

  for (const entry of tests) {
    try {
      await entry.callback();
      results.push({
        name: entry.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: entry.name,
        success: false,
        error:
          error?.stack ||
          error?.message ||
          String(error)
      });
    }
  }

  const failed = results.filter(
    result => !result.success
  );

  results.forEach(result => {
    console.log(
      `${result.success ? "PASS" : "FAIL"}: ${result.name}${
        result.error
          ? ` — ${result.error}`
          : ""
      }`
    );
  });

  console.log(
    `Nutrition Profile: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
