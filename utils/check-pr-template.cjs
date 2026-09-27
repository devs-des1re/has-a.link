"use strict";

const fs = require("fs");
const path = require("path");

const trustedUsers = require("./trusted.json");
const { renderMessage } = require("./messages.cjs");

const TEMPLATE_PATH = path.resolve(__dirname, "..", ".github", "PULL_REQUEST_TEMPLATE.md");

const REQUIRED_CHECKBOXES = [
  { id: "TOS", match: /terms of service/i },
  { id: "DOMAIN_STRUCTURE", match: /domain structure/i },
  { id: "WEBSITE_REACHABLE", match: /reachable/i },
  { id: "SOFTWARE_RELATED", match: /software[-\s]development related/i },
  { id: "NON_COMMERCIAL", match: /not for commercial/i },
  { id: "CONTACT_INFO", match: /accurate contact information/i },
  { id: "WEBSITE_LINK", match: /link and a screenshot/i }
];

const BYPASS_LABELS = ["ci: bypass-template-check", "maintainer", "dependencies"];
const BYPASS_AUTHORS = ["dependabot[bot]", "github-actions[bot]"];

const SECTIONS = [
  {
    name: "Website Preview",
    heading: "website preview",
    start: "<!-- WEBSITE_PREVIEW_START -->",
    end: "<!-- WEBSITE_PREVIEW_END -->"
  },
  {
    name: "Website Purpose",
    heading: "website purpose",
    start: "<!-- WEBSITE_PURPOSE_START -->",
    end: "<!-- WEBSITE_PURPOSE_END -->"
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function cleanContent(raw, placeholderLines) {
  return normalizeLines(stripComments(raw))
    .filter((line) => !placeholderLines.has(line))
    .join("\n");
}

function collectTemplateComments(template) {
  const placeholders = new Set();

  for (const comment of template.match(/<!--[\s\S]*?-->/g) || []) {
    const inner = comment.replace(/^<!--/, "").replace(/-->$/, "");

    for (const line of normalizeLines(inner)) {
      placeholders.add(line);
    }
  }

  return placeholders;
}

function findHeadingLineIndex(lines, heading) {
  const regex = new RegExp(`^#{1,6}\\s*${escapeRegExp(heading)}\\s*$`, "i");

  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i].trim())) return i;
  }

  return -1;
}

function extractByHeading(body, heading, placeholderLines) {
  const lines = body.split(/\r?\n/);
  const index = findHeadingLineIndex(lines, heading);

  if (index === -1) {
    return { found: false, content: "" };
  }

  const collected = [];

  for (let i = index + 1; i < lines.length; i++) {
    if (/^#{1,6}\s+\S/.test(lines[i].trim())) break;
    collected.push(lines[i]);
  }

  return { found: true, content: cleanContent(collected.join("\n"), placeholderLines) };
}

function extractByMarker(body, startMarker, endMarker, placeholderLines) {
  const start = body.indexOf(startMarker);
  const end = start === -1 ? -1 : body.indexOf(endMarker, start + startMarker.length);

  if (start === -1 || end === -1) {
    return { found: false, content: "" };
  }

  return { found: true, content: cleanContent(body.slice(start + startMarker.length, end), placeholderLines) };
}

function extractSection(body, section, placeholderLines) {
  const byHeading = extractByHeading(body, section.heading, placeholderLines);

  if (byHeading.found) return byHeading;

  return extractByMarker(body, section.start, section.end, placeholderLines);
}

function isCheckedLine(line) {
  return /^\s*-\s*\[[xX]\]\s*/.test(line);
}

function checkboxStatus(body, checkbox) {
  const lines = body.split(/\r?\n/);
  let matched = false;

  for (const line of lines) {
    if (!/^\s*-\s*\[[ xX]\]\s*/.test(line)) continue;
    if (!checkbox.match.test(line)) continue;

    matched = true;

    if (isCheckedLine(line)) return "checked";
  }

  return matched ? "unchecked" : "missing";
}

function loadPlaceholderLines() {
  try {
    return collectTemplateComments(fs.readFileSync(TEMPLATE_PATH, "utf8"));
  } catch {
    return new Set();
  }
}

function validateTemplate(body, placeholderLines = loadPlaceholderLines()) {
  const errors = [];

  for (const checkbox of REQUIRED_CHECKBOXES) {
    const status = checkboxStatus(body, checkbox);

    if (status === "missing") {
      errors.push(
        `The \`${checkbox.id}\` requirement line is missing from the template. ` +
          "Restore the original pull request template and check the box."
      );
    } else if (status === "unchecked") {
      errors.push(`The \`${checkbox.id}\` requirement has not been checked.`);
    }
  }

  const hasAnySection = SECTIONS.some((section) => extractSection(body, section, placeholderLines).found);

  if (!hasAnySection) {
    errors.push(
      "The pull request template appears to have been removed or replaced. " +
        "Restore the original template and fill in the **Website Preview** and **Website Purpose** sections."
    );

    return errors;
  }

  for (const section of SECTIONS) {
    const { found, content } = extractSection(body, section, placeholderLines);

    if (!found) {
      errors.push(
        `The **${section.name}** section is missing. ` +
          "Do not delete sections from the template — fill them in instead."
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

module.exports = {
  validateTemplate,
  extractSection,
  extractByHeading,
  extractByMarker,
  checkboxStatus,
  collectTemplateComments
};
