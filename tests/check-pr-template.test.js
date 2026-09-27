import t from "ava";
import fs from "fs-extra";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { validateTemplate, buildPlaceholderLines } = require("../utils/check-pr-template.cjs");

const template = fs.readFileSync(path.resolve(".github", "PULL_REQUEST_TEMPLATE.md"), "utf8");

function checkedTemplate() {
  return template.replace(/- \[ \]/g, "- [x]");
}

function withSection(start, end, inner) {
  const base = checkedTemplate();
  return base.replace(new RegExp(`${start}[\\s\\S]*?${end}`), `${start}\n${inner}\n${end}`);
}

const PREVIEW_START = "<!-- WEBSITE_PREVIEW_START -->";
const PREVIEW_END = "<!-- WEBSITE_PREVIEW_END -->";
const PURPOSE_START = "<!-- WEBSITE_PURPOSE_START -->";
const PURPOSE_END = "<!-- WEBSITE_PURPOSE_END -->";

t("a fully completed template passes", (t) => {
  let body = withSection(
    PREVIEW_START,
    PREVIEW_END,
    "- Link: https://myname.has-a.link\n- Screenshot: https://i.imgur.com/abc.png"
  );
  body = body.replace(
    new RegExp(`${PURPOSE_START}[\\s\\S]*?${PURPOSE_END}`),
    `${PURPOSE_START}\nmy portfolio\n${PURPOSE_END}`
  );

  t.deepEqual(validateTemplate(body), []);
});

t("unchecked boxes are reported", (t) => {
  const body = checkedTemplate().replace("- [x] <!-- TOS -->", "- [ ] <!-- TOS -->");

  const errors = validateTemplate(body);

  t.true(errors.some((e) => e.includes("TOS")));
});

t("template leftover placeholder text does not count as filled", (t) => {
  const errors = validateTemplate(checkedTemplate());

  t.true(errors.some((e) => e.includes("Website Preview")));
  t.true(errors.some((e) => e.includes("Website Purpose")));
});

t("missing closing marker is detected, not reported as empty", (t) => {
  const body = checkedTemplate().replace(PURPOSE_END, "");

  const errors = validateTemplate(body);

  t.true(errors.some((e) => e.includes("missing its closing marker")));
  t.false(errors.some((e) => e.includes("Website Purpose** section has not been filled out")));
});

t("missing opening marker is detected", (t) => {
  const body = checkedTemplate().replace(PREVIEW_START, "");

  const errors = validateTemplate(body);

  t.true(errors.some((e) => e.includes("missing its opening marker")));
});

t("fully removed template is detected", (t) => {
  const errors = validateTemplate("Just a normal PR description with no markers.");

  t.true(errors.some((e) => e.includes("removed or replaced")));
});

t("placeholder lines are derived from the template", (t) => {
  const lines = buildPlaceholderLines(template);

  t.true(lines.has("Add a link to your website and a screenshot here."));
  t.true(lines.has("Briefly describe what your website is and what it is used for."));
});

t("placeholder text plus a real answer passes", (t) => {
  let body = withSection(
    PREVIEW_START,
    PREVIEW_END,
    "- Link: https://example.com\n- Screenshot: https://i.imgur.com/x.png"
  );
  body = body.replace(
    new RegExp(`${PURPOSE_START}[\\s\\S]*?${PURPOSE_END}`),
    `${PURPOSE_START}\nsdsadsadsa\n${PURPOSE_END}`
  );

  t.deepEqual(validateTemplate(body), []);
});
