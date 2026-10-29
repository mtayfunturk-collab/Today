const assert = require("node:assert/strict");
const fs = require("node:fs");

const packageJson =
  JSON.parse(
    fs.readFileSync(
      "package.json",
      "utf8"
    )
  );
const lock =
  JSON.parse(
    fs.readFileSync(
      "package-lock.json",
      "utf8"
    )
  );
const workflow =
  fs.readFileSync(
    ".github/workflows/platform-regression.yml",
    "utf8"
  );
const runner =
  fs.readFileSync(
    "tests/run-platform-regression.cjs",
    "utf8"
  );

const results = [];

function test(name, callback) {
  try {
    callback();
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

test(
  "Test paketi özel ve lockfile sürümüyle uyumlu",
  () => {
    assert.equal(
      packageJson.private,
      true
    );
    assert.match(
      packageJson.version,
      /^\d+\.\d+\.\d+$/
    );
    assert.equal(
      packageJson.version,
      lock.packages[""].version
    );
  }
);

test(
  "Tek npm test komutu birleşik regresyon koşucusunu açıyor",
  () => {
    assert.equal(
      packageJson.scripts.test,
      "node tests/run-platform-regression.cjs"
    );
  }
);

test(
  "Tarayıcı ve IndexedDB test bağımlılıkları kesin sürüme sabitlenmiş",
  () => {
    assert.equal(
      packageJson
        .devDependencies
        .jsdom,
      "29.0.0"
    );
    assert.equal(
      lock.packages[""]
        .devDependencies
        .jsdom,
      "29.0.0"
    );
    assert.equal(
      packageJson
        .devDependencies
        ["fake-indexeddb"],
      "6.2.5"
    );
    assert.equal(
      lock.packages[""]
        .devDependencies
        ["fake-indexeddb"],
      "6.2.5"
    );
  }
);

test(
  "Lockfile paket kimliği ve Node sınırıyla eşleşiyor",
  () => {
    assert.equal(
      lock.name,
      packageJson.name
    );
    assert.equal(
      lock.version,
      packageJson.version
    );
    assert.equal(
      lock.packages[""]
        .engines.node,
      ">=20.19.0"
    );
  }
);

test(
  "GitHub kapısı push ve pull request değişikliklerinde çalışıyor",
  () => {
    assert.match(
      workflow,
      /\n  push:\n/
    );
    assert.match(
      workflow,
      /\n  pull_request:\n/
    );
    const targets = [
      '"index.html"',
      '"storage.js"',
      '"health-hub.js"',
      '"version.js"',
      '"sw.js"',
      '"manifest.json"',
      '"nutrition-unit-rules.json"',
      '"modules/**"',
      '"contracts/**"',
      '"Today-AI-Engine/**"',
      '"assets/**"',
      '"vendor/**"',
      '"data/**"',
      '"*.png"',
      '"tests/**"',
      '"scripts/**"',
      '"package.json"',
      '"package-lock.json"',
      '".github/workflows/platform-regression.yml"'
    ];
    ["push", "pull_request"].forEach(event => {
      const paths = workflow.match(new RegExp(
        `\\n  ${event}:\\n    paths:\\n((?:      - .+\\n)+)`
      ));
      assert.ok(paths, `${event} paths`);
      targets.forEach(target => {
        assert.ok(paths[1].includes(`- ${target}\n`), `${event}: ${target}`);
      });
    });
  }
);

test(
  "GitHub kapısı yalnız okuma izniyle npm ci ve npm test çalıştırıyor",
  () => {
    assert.match(
      workflow,
      /permissions:\n  contents: read/
    );
    assert.ok(
      workflow.includes(
        "npm ci --ignore-scripts"
      )
    );
    assert.ok(
      workflow.includes(
        "npm test"
      )
    );
    assert.equal(
      workflow.includes(
        "pages: write"
      ),
      false
    );
  }
);

test(
  "Koşucu 25 platform grubunu ve test envanterinin tam kapsamını doğruluyor",
  () => {
    const files = [
      ...runner.matchAll(
        /file:\s*\n?\s*"([^"]+\.cjs)"/g
      )
    ].map(match => match[1]);

    assert.equal(
      files.length,
      25
    );
    assert.equal(
      new Set(files).size,
      files.length
    );
    assert.equal(
      files[0],
      "tests/nutrition-contracts.test.cjs"
    );
    assert.equal(
      files.at(-1),
      "tests/platform-browser-regression.test.cjs"
    );

    const aiRunner = fs.readFileSync("tests/run-nut-017.9.cjs", "utf8");
    const aiFiles = [...aiRunner.matchAll(/"(tests\/[^\"]+\.test\.(?:cjs|mjs))"/g)]
      .map(match => match[1]);
    const registered = [...files, ...aiFiles];
    assert.equal(new Set(registered).size, registered.length);
    const discovered = fs.readdirSync("tests")
      .filter(file => /\.test\.(?:cjs|mjs)$/.test(file) || file === "sw-event-regression.cjs")
      .map(file => `tests/${file}`);
    assert.deepEqual([...registered].sort(), discovered.sort());
    assert.ok(workflow.includes("node tests/run-nut-017.9.cjs"));

    const engineRunner = fs.readFileSync("Today-AI-Engine/tests/run-tests.mjs", "utf8");
    const engineFiles = [...engineRunner.matchAll(/from '\.\/([^']+\.test\.mjs)'/g)]
      .map(match => match[1]);
    assert.deepEqual(engineFiles.sort(), fs.readdirSync("Today-AI-Engine/tests")
      .filter(file => file.endsWith(".test.mjs")).sort());
  }
);

test(
  "Koşucu Türkiye saat dilimi ve 1155 kontrollük NUT-018.1 kapısını kilitliyor",
  () => {
    assert.ok(
      runner.includes(
        'TZ: "Europe/Istanbul"'
      )
    );

    const counts = [
      ...runner.matchAll(
        /count:\s*(\d+)/g
      )
    ].map(match =>
      Number(match[1])
    );

    assert.equal(
      counts.reduce(
        (sum, value) =>
          sum + value,
        0
      ),
      1155
    );
  }
);

const failed =
  results.filter(
    result =>
      !result.success
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
  `Automation Contract: ${
    results.length -
    failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
