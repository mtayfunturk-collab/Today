const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "..", "modules", "health-hub.js"),
  "utf8"
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dom = new JSDOM(`<!doctype html>
<html><head></head><body>
<div class="wrap"><div class="screen">
  <div class="inner healthView" data-view="health">
    <div class="topbar">
      <button id="btnModulesFromHealth"></button>
      <span class="pill">Today Health</span>
    </div>
    <header class="healthHero">
      <h1 id="healthTitle">Beslenme</h1>
    </header>
    <div id="healthDashboard">
      <div class="healthCard"></div>
    </div>
  </div>
</div></div>
<button data-open-module="health"></button>
</body></html>`, {
  runScripts: "outside-only",
  url: "https://example.test/Today/"
});

dom.window.scrollTo = () => {};
dom.window.TodayNutritionUI = { open: async () => {} };
dom.window.TodayNutritionLibraryUI = { open: async () => {} };

new vm.Script(source).runInContext(dom.getInternalVMContext());

const api = dom.window.TodayHealthHub;
assert(api, "TodayHealthHub API yayımlanmadı.");
assert(api.getState().initialized === true, "Health Hub başlatılmadı.");

const view = dom.window.document.querySelector('[data-view="health"]');
assert(view.querySelector("#healthHub"), "Health Hub yüzeyi oluşmadı.");
assert(
  view.querySelectorAll("[data-health-hub-open]").length === 3,
  "Spor / Beslenme / Sağlık üçlü girişi oluşmadı."
);
assert(
  view.querySelector("#healthNutritionPanel"),
  "Mevcut Beslenme paneli korunmadı."
);

api.showSection("nutrition", { focus: false, scroll: false });
assert(
  api.getState().activeSection === "nutrition",
  "Beslenme alt modülüne geçilemedi."
);
assert(
  view.querySelector("#healthNutritionPanel").hidden === false,
  "Beslenme paneli görünür olmadı."
);

api.showSection("sport", { focus: false, scroll: false });
assert(
  view.querySelector("#healthSportPanel").hidden === false,
  "Spor paneli görünür olmadı."
);

api.showSection("wellness", { focus: false, scroll: false });
assert(
  view.querySelector("#healthWellnessPanel").hidden === false,
  "Sağlık paneli görünür olmadı."
);

const styleText =
  dom.window.document.getElementById("todayHealthHubStyles")?.textContent || "";

assert(
  styleText.includes("overflow-x: clip"),
  "Yatay taşma koruması bulunamadı."
);
assert(
  styleText.includes("100dvh"),
  "Dinamik viewport yüksekliği koruması bulunamadı."
);
assert(
  styleText.includes("safe-area-inset"),
  "Safe-area koruması bulunamadı."
);

console.log("NUT-013 Health Hub: 10/10 başarılı");
