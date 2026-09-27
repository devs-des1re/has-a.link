import t from "ava";
import fs from "fs-extra";
import path from "path";
import { createRequire } from "module";

import trustedUsers from "../utils/trusted.json" with { type: "json" };

const require = createRequire(import.meta.url);
const { validateOwnership } = require("../utils/domain-rules.cjs");

const requiredEnvVars = ["PR_AUTHOR", "PR_AUTHOR_ID", "CHANGED_FILES", "DELETED_FILES"];

const trusted = trustedUsers.map((u) => String(u.id));
const admins = trustedUsers.filter((u) => u.admin).map((u) => String(u.id));

function getDomainData(subdomain) {
  try {
    return fs.readJsonSync(path.join(path.resolve("domains"), `${subdomain}.json`));
  } catch (error) {
    throw new Error(`Failed to read JSON for ${subdomain}: ${error.message}`);
  }
}

function assertAuthorized(t, file, data, prAuthor, prAuthorId) {
  const subdomain = file.replace(/\.json$/, "");

  const findings = validateOwnership({ subdomain, data, prAuthor, prAuthorId, trusted, admins });

  findings.forEach((finding) => {
    t.true(false, `${file}: ${finding.problem} Fix: ${finding.fix}`);
  });
}

t("Users cannot modify generated or protected files", (t) => {
  if (!requiredEnvVars.every((v) => process.env[v])) {
    t.pass();
    return;
  }

  const prAuthorId = process.env.PR_AUTHOR_ID;
  const labels = JSON.parse(process.env.PR_LABELS || "[]");

  if (labels.includes("ci: bypass-owner-check")) {
    t.pass();
    return;
  }

  const changedFiles = JSON.parse(process.env.CHANGED_FILES);
  const protectedFiles = ["domains.json"];

  changedFiles
    .filter((file) => protectedFiles.includes(file))
    .forEach((file) => {
      t.true(trusted.includes(prAuthorId), `${file}: this file is generated and can only be changed by maintainers`);
    });

  t.pass();
});

t("Users can only update their own subdomains", (t) => {
  if (!requiredEnvVars.every((v) => process.env[v])) {
    t.pass();
    return;
  }

  const changedFiles = JSON.parse(process.env.CHANGED_FILES);
  const deletedFiles = JSON.parse(process.env.DELETED_FILES);
  const prAuthor = process.env.PR_AUTHOR.toLowerCase();
  const prAuthorId = process.env.PR_AUTHOR_ID;
  const labels = JSON.parse(process.env.PR_LABELS || "[]");

  if (labels.includes("ci: bypass-owner-check")) {
    t.pass();
    return;
  }

  const changedJSONFiles = changedFiles
    .filter((file) => file.startsWith("domains/") && file.endsWith(".json"))
    .map((file) => path.basename(file));
  const deletedJSONFiles = deletedFiles
    .filter((file) => file.name.startsWith("domains/") && file.name.endsWith(".json"))
    .map((file) => path.basename(file.name));

  changedJSONFiles.forEach((file) => {
    assertAuthorized(t, file, getDomainData(file.replace(/\.json$/, "")), prAuthor, prAuthorId);
  });

  deletedJSONFiles.forEach((file) => {
    const entry = deletedFiles.find((f) => path.basename(f.name) === file);
    const data = JSON.parse(
      entry.data
        .split("\n")
        .filter((line) => line.startsWith("-") && !line.startsWith("---"))
        .map((line) => line.substring(1))
        .join("\n")
    );

    assertAuthorized(t, file, data, prAuthor, prAuthorId);
  });

  t.pass();
});
