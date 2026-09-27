"use strict";

const fs = require("fs");
const path = require("path");

const trustedUsers = require("./trusted.json");
const { renderMessage } = require("./messages.cjs");

const TEMPLATE_PATH = path.resolve(__dirname, "..", ".github", "PULL_REQUEST_TEMPLATE.md");

const REQUIRED_CHECKBOXES = [
  "TOS",
  "DOMAIN_STRUCTURE",
  "WEBSITE_REACHABLE",
  "SOFTWARE_RELATED",
  "NON_COMMERCIAL",
  "CONTACT_INFO",
  "WEBSITE_LINK"
];

const BYPASS_LABELS = ["ci: bypass-template-check", "maintainer", "dependencies"];
const BYPASS_AUTHORS = ["dependabot[bot]", "github-actions[bot]"];

const SECTIONS = [
  {
    name: "Website Preview",
    start: "<!-- WEBSITE_PREVIEW_START -->",
    end: "<!-- WEBSITE_PREVIEW_END -->"
  },
  {
    name: "Website Purpose",
    start: "<!-- WEBSITE_PURPOSE_START -->",
    end: "<!-- WEBSITE_PURPOSE_END -->"
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCheckboxChecked(body, marker) {
  const regex = new RegExp(`-\\s*\\[[xX]\\]\\s*<!--\\s*${marker}\\s*-->`, "i");

  return regex.test(body);
}

function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildPlaceholderLines(template) {
  const placeholders = new Set();

  for (const section of SECTIONS) {
    const start = template.indexOf(section.start);
    const end = template.indexOf(section.end, start + section.start.length);

    if (start === -1 || end === -1) continue;

    const raw = template.slice(start + section.start.length, end);
    const commentBodies = raw.match(/<!--[\s\S]*?-->/g) || [];

    for (const comment of commentBodies) {
      const inner = comment.replace(/^<!--/, "").replace(/-->$/, "");

      for (const line of normalizeLines(inner)) {
        placeholders.add(line);
      }
    }
  }

  return placeholders;
}

function extractSection(body, startMarker, endMarker, placeholderLines) {
  const start = body.indexOf(startMarker);

  if (start === -1) {
    return { status: "missing-start", content: "" };
  }

  const end = body.indexOf(endMarker, start + startMarker.length);

  if (end === -1) {
    return { status: "missing-end", content: "" };
  }

  const raw = body.slice(start + startMarker.length, end);
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, "");

  const content = normalizeLines(withoutComments)
    .filter((line) => !placeholderLines.has(line))
    .join("\n");

  return { status: "ok", content };
}

function loadPlaceholderLines() {
  try {
    return buildPlaceholderLines(fs.readFileSync(TEMPLATE_PATH, "utf8"));
  } catch {
    return new Set();
  }
}

function validateTemplate(body, placeholderLines = loadPlaceholderLines()) {
  const errors = [];

  for (const checkbox of REQUIRED_CHECKBOXES) {
    if (!isCheckboxChecked(body, checkbox)) {
      errors.push(`The \`${checkbox}\` requirement has not been checked.`);
    }
  }

  const hasAnyMarker = SECTIONS.some((section) => body.includes(section.start));

  if (!hasAnyMarker) {
    errors.push(
      "The pull request template appears to have been removed or replaced. " +
        "Restore the original template and fill in the **Website Preview** and **Website Purpose** sections."
    );

    return errors;
  }

  for (const section of SECTIONS) {
    const { status, content } = extractSection(body, section.start, section.end, placeholderLines);

    if (status === "missing-start") {
      errors.push(
        `The **${section.name}** section is missing its opening marker \`${section.start}\`. ` +
          "Restore the template instead of removing its markers."
      );
    } else if (status === "missing-end") {
      errors.push(
        `The **${section.name}** section is missing its closing marker \`${section.end}\`. ` +
          "Restore the template instead of removing its markers."
      );
    } else if (!content) {
      errors.push(`The **${section.name}** section has not been filled out.`);
    }
  }

  return errors;
}

function main() {
  const body = process.env.PR_BODY || "";
  const authorUsername = process.env.PR_AUTHOR || "";
  const authorId = Number(process.env.PR_AUTHOR_ID);
  const labels = JSON.parse(process.env.PR_LABELS || "[]");

  const isTrustedUser = trustedUsers.some((u) => u.id === authorId);
  const isBotAuthor = BYPASS_AUTHORS.includes(authorUsername.toLowerCase());
  const hasBypassLabel = labels.some((l) => BYPASS_LABELS.includes(l));

  if (isTrustedUser) {
    console.log(`PR author "${authorUsername}" is a trusted user. Skipping template validation.`);
    process.exit(0);
  }

  if (isBotAuthor) {
    console.log(`PR author "${authorUsername}" is an automated bot. Skipping template validation.`);
    process.exit(0);
  }

  if (hasBypassLabel) {
    console.log("PR has a label which bypasses this check. Skipping template validation.");
    process.exit(0);
  }

  const errors = validateTemplate(body);

  if (errors.length > 0) {
    console.error("PR template validation failed.");
    console.error("");
    console.error(errors.join("\n"));

    const messageBody = renderMessage("incomplete-pr-template", {
      errors: errors.map((error) => `- ${error}`).join("\n")
    });

    fs.writeFileSync(path.resolve(".pr-message.md"), messageBody, "utf8");

    process.exit(1);
  }

  console.log("PR template validation passed.");
}

if (require.main === module) {
  main();
}

module.exports = { validateTemplate, extractSection, isCheckboxChecked, buildPlaceholderLines };
