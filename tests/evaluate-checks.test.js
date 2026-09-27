import t from "ava";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { evaluateChecks, latestByName, REQUIRED_CHECKS } = require("../utils/evaluate-checks.cjs");

function run(name, conclusion, status = "completed", id = 1) {
  return { name, conclusion, status, id };
}

function allPassing(extra = []) {
  return [...REQUIRED_CHECKS.map((name, i) => run(name, "success", "completed", i + 1)), ...extra];
}

t("all checks passing means ready", (t) => {
  const result = evaluateChecks(allPassing());

  t.true(result.ready);
  t.deepEqual(result.failed, []);
  t.deepEqual(result.pending, []);
  t.deepEqual(result.missing, []);
});

t("a failing check blocks readiness", (t) => {
  const runs = allPassing().map((r) => (r.name === "Template" ? run("Template", "failure", "completed", 99) : r));

  const result = evaluateChecks(runs);

  t.false(result.ready);
  t.deepEqual(result.failed, ["Template"]);
});

t("a pending check blocks readiness", (t) => {
  const runs = allPassing().map((r) => (r.name === "Tests" ? run("Tests", null, "in_progress", 99) : r));

  const result = evaluateChecks(runs);

  t.false(result.ready);
  t.deepEqual(result.pending, ["Tests"]);
});

t("a missing check blocks readiness", (t) => {
  const runs = allPassing().filter((r) => r.name !== "Duplicate Check");

  const result = evaluateChecks(runs);

  t.false(result.ready);
  t.deepEqual(result.missing, ["Duplicate Check"]);
});

t("skipped and neutral checks count as passing", (t) => {
  const runs = REQUIRED_CHECKS.map((name, i) => {
    if (name === "Template") return run(name, "skipped", "completed", i + 1);
    if (name === "Duplicate Check") return run(name, "neutral", "completed", i + 1);
    return run(name, "success", "completed", i + 1);
  });

  t.true(evaluateChecks(runs).ready);
});

t("only the latest run for a name counts", (t) => {
  const runs = [
    run("Template", "failure", "completed", 1),
    run("Template", "success", "completed", 2),
    ...REQUIRED_CHECKS.filter((n) => n !== "Template").map((n, i) => run(n, "success", "completed", 10 + i))
  ];

  t.true(evaluateChecks(runs).ready);
});

t("latestByName keeps the newest", (t) => {
  const latest = latestByName([run("A", "failure", "completed", 1), run("A", "success", "completed", 5)]);

  t.is(latest.get("A").conclusion, "success");
});

t("unrelated checks do not affect readiness", (t) => {
  const runs = allPassing([run("Some Other Job", "failure", "completed", 500)]);

  t.true(evaluateChecks(runs).ready);
});
