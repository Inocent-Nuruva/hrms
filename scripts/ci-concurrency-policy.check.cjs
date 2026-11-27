const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const yaml = require("js-yaml");

const workflow = yaml.load(
  readFileSync(".github/workflows/hrms-frontend-ci.yml", "utf8"),
);
test("obsolete branch checks cancel without cancelling manual runs or other shards", () => {
  for (const name of ["validate-and-package", "browser-shard"]) {
    const concurrency = workflow.jobs[name].concurrency;
    assert.equal(concurrency["cancel-in-progress"], true);
    assert.match(concurrency.group, /github\.event_name/);
    assert.match(concurrency.group, /github\.ref/);
    assert.match(concurrency.group, /workflow_dispatch.*github\.run_id/);
  }
  assert.match(
    workflow.jobs["browser-shard"].concurrency.group,
    /matrix\.shard/,
  );
  assert.equal(
    workflow.jobs["verify-manual-illustrations"].concurrency[
      "cancel-in-progress"
    ],
    true,
  );
});

test("deployments queue and release and evidence retention is limited", () => {
  const concurrency = workflow.jobs.deploy.concurrency;
  assert.equal(concurrency["cancel-in-progress"], false);
  assert.equal(concurrency.queue, "max");
  const release = workflow.jobs["validate-and-package"].steps.find(
    (step) => step.name === "Upload validated release",
  );
  assert.equal(release.with["retention-days"], 3);
  for (const step of workflow.jobs["browser-shard"].steps.filter(
    (entry) => entry.uses === "actions/upload-artifact@v4",
  ))
    assert.equal(step.with["retention-days"], 7);
  for (const step of workflow.jobs["verify-manual-illustrations"].steps.filter(
    (entry) => entry.uses === "actions/upload-artifact@v4",
  ))
    assert.equal(step.with["retention-days"], 7);
});
