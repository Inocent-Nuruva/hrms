const { spawnSync } = require("node:child_process");

const cli = require.resolve("@playwright/test/cli");
const files = [
  "e2e/onboarding-workspace.spec.ts",
  "e2e/forms-feedback.spec.ts",
  "e2e/public.spec.ts",
  "e2e/auth-session-policy.spec.ts",
  "e2e/probation-access.spec.ts",
  "e2e/company-directory.spec.ts",
  "e2e/notification-routing.spec.ts",
  "e2e/organization-structure.spec.ts",
  "e2e/attendance-navigation.spec.ts",
  "e2e/leave-calendar.spec.ts",
  "e2e/movement-workflow.spec.ts",
  "e2e/self-service-workspace.spec.ts",
  "e2e/profile-record-modals.spec.ts",
];

// Total seconds per file from the most recent successful UAT browser run.
const durations = {
  "attendance-navigation.spec.ts": 15,
  "auth-session-policy.spec.ts": 13.524,
  "company-directory.spec.ts": 16.1,
  "forms-feedback.spec.ts": 6.6,
  "leave-calendar.spec.ts": 20.6,
  "movement-workflow.spec.ts": 22.3,
  "notification-routing.spec.ts": 14.1,
  "onboarding-workspace.spec.ts": 65.3,
  "organization-structure.spec.ts": 9.1,
  "probation-access.spec.ts": 26.2,
  "profile-record-modals.spec.ts": 9,
  "public.spec.ts": 2.8,
  "self-service-workspace.spec.ts": 17.9,
};

function assignedFiles(shard) {
  const groups = [
    { duration: 0, files: [] },
    { duration: 0, files: [] },
  ];
  const sorted = [...files].sort((a, b) => {
    const byDuration =
      (durations[b.split("/").pop()] ?? 10) -
      (durations[a.split("/").pop()] ?? 10);
    return byDuration || a.localeCompare(b, "en");
  });
  for (const file of sorted) {
    const group =
      groups[0].duration <= groups[1].duration ? groups[0] : groups[1];
    group.files.push(file);
    group.duration += durations[file.split("/").pop()] ?? 10;
  }
  return groups[shard - 1].files;
}

function discover(shard) {
  const args = [
    cli,
    "test",
    ...(shard ? assignedFiles(shard) : files),
    "--list",
    "--reporter=json",
  ];
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.stdout || "Playwright discovery failed",
    );
  const report = JSON.parse(result.stdout);
  const found = [];
  function visit(suite) {
    for (const spec of suite.specs || [])
      for (const entry of spec.tests || [])
        found.push(`${spec.id}:${entry.projectId}`);
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites || []) visit(suite);
  return found;
}

const [mode, shard] = process.argv.slice(2);
if (mode === "verify") {
  const all = discover();
  const one = discover(1);
  const two = discover(2);
  const a = new Set(one);
  const b = new Set(two);
  if (
    !all.length ||
    !one.length ||
    !two.length ||
    one.some((id) => b.has(id)) ||
    all.some((id) => !a.has(id) && !b.has(id)) ||
    a.size + b.size !== all.length
  ) {
    throw new Error("Browser shards are empty, overlap, or omit tests");
  }
  console.log(
    `Browser shard coverage verified: ${one.length} + ${two.length} = ${all.length} tests`,
  );
} else if (mode === "run" && ["1", "2"].includes(shard)) {
  const result = spawnSync(
    process.execPath,
    [cli, "test", ...assignedFiles(Number(shard))],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} else {
  throw new Error("Expected verify or run <1|2>");
}
