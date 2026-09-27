"use strict";

const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");
const MARKER_PREFIX = "has-a-link-bot";

function messagePath(key) {
  return path.join(MESSAGES_DIR, `${key}.md`);
}

function hasMessage(key) {
  return fs.existsSync(messagePath(key));
}

function loadMessage(key) {
  const file = messagePath(key);

  if (!fs.existsSync(file)) {
    throw new Error(`Unknown message "${key}". Expected a file at messages/${key}.md`);
  }

  return fs.readFileSync(file, "utf8");
}

function getMarker(key) {
  const file = messagePath(key);

  if (fs.existsSync(file)) {
    const match = fs.readFileSync(file, "utf8").match(/^<!--\s*marker:\s*([^\s>]+)\s*-->/m);

    if (match) {
      return `<!-- ${MARKER_PREFIX}: ${match[1]} -->`;
    }
  }

  return `<!-- ${MARKER_PREFIX}: ${key} -->`;
}

function renderMessage(key, vars = {}) {
  const template = loadMessage(key);

  const withoutMarker = template.replace(/^<!--\s*marker:[^>]*-->\s*\n?/m, "");

  const rendered = withoutMarker.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, name) => {
    const value = name.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), vars);

    if (value === undefined || value === null) {
      return match;
    }

    return String(value);
  });

  return `${getMarker(key)}\n${rendered.replace(/^\s*\n/, "")}`;
}

function listMessages() {
  if (!fs.existsSync(MESSAGES_DIR)) return [];

  return fs
    .readdirSync(MESSAGES_DIR)
    .filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md")
    .map((file) => file.replace(/\.md$/, ""));
}

module.exports = {
  MESSAGES_DIR,
  MARKER_PREFIX,
  hasMessage,
  loadMessage,
  getMarker,
  renderMessage,
  listMessages
};
