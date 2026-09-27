"use strict";

const fs = require("fs");
const path = require("path");

const { validateDomainFile } = require("./domain-rules.cjs");
const { renderMessage } = require("./messages.cjs");

const reserved = require("./reserved.json");
const internal = require("./internal.json");
const disallowedCNAMEs = require("./disallowed-cnames.json");
const trustedUsers = require("./trusted.json");

const trusted = trustedUsers.map((u) => String(u.id));
const admins = trustedUsers.filter((u) => u.admin).map((u) => String(u.id));

const prAuthor = process.env.PR_AUTHOR;
const prAuthorId = process.env.PR_AUTHOR_ID;
const prLabels = JSON.parse(process.env.PR_LABELS || "[]");
const bypassOwnerCheck = prLabels.includes("ci: bypass-owner-check");

const inputPath = process.argv[2] || ".pr-input";
const outputPath = ".pr-message.md";

function readInput() {
  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    return [];
  }

  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    return fs
      .readdirSync(resolved)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => ({
        filename: file,
        raw: fs.readFileSync(path.join(resolved, file), "utf8")
      }));
  }

  const raw = fs.readFileSync(resolved, "utf8");

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Could not parse PR input JSON.");
    process.exit(1);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((entry) => ({ filename: entry.filename, raw: entry.raw, added: entry.added }));
  }

  return [{ filename: parsed.filename, raw: parsed.raw, added: parsed.added }];
}

function parseDomain(filename, raw) {
  const subdomain = filename.replace(/^.*[/\\]/, "").replace(/\.json$/, "");
  let data;

  try {
    data = JSON.parse(raw);
  } catch (error) {
    return {
      subdomain,
      filename,
      findings: [
        {
          path: filename,
          problem: `The file is not valid JSON: ${error.message}`,
          fix: "Fix the JSON syntax. You can check it with a JSON validator."
        }
      ]
    };
  }

  const includeOwnership = !bypassOwnerCheck && prAuthor !== undefined && prAuthorId !== undefined;

  const findings = validateDomainFile({
    subdomain,
    raw,
    data,
    reserved,
    internal,
    disallowedCNAMEs,
    prAuthor: includeOwnership ? prAuthor : undefined,
    prAuthorId: includeOwnership ? prAuthorId : undefined,
    trusted,
    admins
  });

  return { subdomain, filename, findings };
}

function formatFindings(filename, findings) {
  return findings
    .map((finding) => {
      const location = finding.path && finding.path !== filename ? ` (\`${finding.path}\`)` : "";
      return `- **${finding.problem}**${location}\n  - *Fix:* ${finding.fix}`;
    })
    .join("\n");
}

const input = readInput();

if (!input.length) {
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  console.log("No domain files to validate.");
  process.exit(0);
}

const results = input.filter((entry) => entry.added !== false).map((entry) => parseDomain(entry.filename, entry.raw));
const failing = results.filter((result) => result.findings.length > 0);

if (!failing.length) {
  console.log("All changed domain files are valid.");
  process.exit(0);
}

const summary = failing
  .map((result) => {
    return [`### \`${result.subdomain}.has-a.link\``, "", formatFindings(result.filename, result.findings)].join("\n");
  })
  .join("\n\n");

const body = renderMessage("invalid-domain", {
  count: failing.length,
  findings: summary
});

fs.writeFileSync(outputPath, body, "utf8");

console.error(`Validation failed for ${failing.length} file(s).`);
for (const result of failing) {
  for (const finding of result.findings) {
    console.error(`- ${result.subdomain}: ${finding.problem} (${finding.fix})`);
  }
}

process.exit(1);
