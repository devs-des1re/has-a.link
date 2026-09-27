import t from "ava";
import fs from "fs-extra";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { renderMessage, getMarker, listMessages, loadMessage } = require("../utils/messages.cjs");

const messagesDir = path.resolve("messages");

t("Every message file starts with a marker comment", (t) => {
  const keys = listMessages();

  t.true(keys.length > 0, "Expected at least one message template");

  keys.forEach((key) => {
    const contents = loadMessage(key);
    t.regex(contents, /^<!--\s*marker:\s*[^\s>]+\s*-->/m, `${key}: missing marker comment on its own line`);
  });
});

t("Markers are unique", (t) => {
  const markers = listMessages().map((key) => getMarker(key));

  t.is(new Set(markers).size, markers.length, "Duplicate bot markers found");
});

t("Rendering fills placeholders and includes the marker", (t) => {
  const rendered = renderMessage("duplicate-request", { conflicts: "- `foo.has-a.link` is also requested by #12" });

  t.true(rendered.includes("<!-- has-a-link-bot: duplicate-request -->"));
  t.true(rendered.includes("#12"));
  t.false(rendered.includes("{{conflicts}}"));
});

t("Unknown message keys throw", (t) => {
  t.throws(() => renderMessage("does-not-exist"));
});

t("Unknown placeholders are left untouched", (t) => {
  const rendered = renderMessage("duplicate-request", {});

  t.true(rendered.includes("{{conflicts}}"));
});

t("Message directory exists next to utils", (t) => {
  t.true(fs.existsSync(messagesDir));
});
