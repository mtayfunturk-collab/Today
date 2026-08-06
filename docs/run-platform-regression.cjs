const path = require("node:path");
const {
  spawnSync
} = require("node:child_process");

const ROOT = path.resolve(
  __dirname,
  ".."
);

const TEST_GROUPS = Object.freeze([
  {
    file:
      "tests/nutrition-contracts.test.cjs",
    count: 60
  },
  {
    file:
      "tests/nutrition-storage.test.cjs",
    count: 50
  },
  {
    file:
      "tests/nutrition-migrations.test.cjs",
    count: 20
  },
  {
    file:
      "tests/nutrition-calculations.test.cjs",
    count: 84
  },
  {
    file:
      "tests/nutrition-profile.test.cjs",
    count: 82
  },
  {
    file:
      "tests/nutrition-library.test.cjs",
    count: 98
  },
  {
    file:
      "tests/nutrition-library-ui.test.cjs",
    count: 52
  },
  {
    file:
      "tests/nutrition-entry.test.cjs",
    count: 90
  },
  {
    file:
      "tests/nutrition-planning.test.cjs",
    count: 110
  },
  {
    file:
      "tests/nutrition-history.test.cjs",
    count: 54
  },
  {
    file:
      "tests/nutrition-ui.test.cjs",
    count: 106
  },
  {
    file:
      "tests/adapter-interfaces.test.cjs",
    count: 42
  },
  {
    file:
      "tests/error-manager.test.cjs",
    count: 28
  },
  {
    file:
      "tests/migration-integration.test.cjs",
    count: 10
  },
  {
    file:
      "tests/migration.test.cjs",
    count: 31
  },
  {
    file:
      "tests/module-registry.test.cjs",
    count: 18
  },
  {
    file:
      "tests/router.test.cjs",
    count: 15
  },
  {
    file:
      "tests/service-worker-manager.test.cjs",
    count: 29
  },
  {
    file:
      "tests/startup-manager.test.cjs",
    count: 15
  },
  {
    file:
      "tests/static-regression.test.cjs",
    count: 30
  },
  {
    file:
      "tests/sw-event-regression.cjs",
    count: 36
  },
  {
    file:
      "tests/automation-contract.test.cjs",
    count: 8
  },
  {
    file:
      "tests/platform-browser-regression.test.cjs",
    count: 48
  }
]);

let passedCount = 0;
const failures = [];

TEST_GROUPS.forEach(group => {
  const result = spawnSync(
    process.execPath,
    [group.file],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        TZ: "Europe/Istanbul"
      },
      encoding: "utf8",
      maxBuffer:
        16 * 1024 * 1024
    }
  );
  const output = [
    result.stdout,
    result.stderr
  ]
    .filter(Boolean)
    .join("");

  process.stdout.write(
    `\n=== ${group.file} ===\n`
  );
  process.stdout.write(output);

  if (
    result.status !== 0 ||
    !output.includes(
      `${group.count}/${group.count}`
    )
  ) {
    failures.push({
      file: group.file,
      status: result.status,
      expectedCount:
        group.count
    });
    return;
  }

  passedCount +=
    group.count;
});

const expectedCount =
  TEST_GROUPS.reduce(
    (sum, group) =>
      sum + group.count,
    0
  );

if (failures.length > 0) {
  console.error(
    "\nPlatform Regression Gate başarısız:",
    failures
  );
  process.exitCode = 1;
} else {
  console.log(
    `\nPlatform Regression Gate: ${passedCount}/${expectedCount} başarılı`
  );
}
