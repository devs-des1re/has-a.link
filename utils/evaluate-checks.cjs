"use strict";

const REQUIRED_CHECKS = ["Tests", "Label", "Validate", "Duplicate Check", "Template"];

const ACCEPTABLE_CONCLUSIONS = new Set(["success", "skipped", "neutral"]);

function latestByName(checkRuns) {
  const latest = new Map();

  for (const run of checkRuns) {
    const previous = latest.get(run.name);

    if (!previous || (run.id ?? 0) > (previous.id ?? 0)) {
      latest.set(run.name, run);
    }
  }

  return latest;
}

function evaluateChecks(checkRuns, required = REQUIRED_CHECKS) {
  const latest = latestByName(checkRuns);

  const missing = [];
  const pending = [];
  const failed = [];

  for (const name of required) {
    const run = latest.get(name);

    if (!run) {
      missing.push(name);
      continue;
    }

    if (run.status !== "completed") {
      pending.push(name);
      continue;
    }

    if (!ACCEPTABLE_CONCLUSIONS.has(run.conclusion)) {
      failed.push(name);
    }
  }

  const ready = missing.length === 0 && pending.length === 0 && failed.length === 0;

  return { ready, missing, pending, failed, required };
}

module.exports = { REQUIRED_CHECKS, ACCEPTABLE_CONCLUSIONS, latestByName, evaluateChecks };
