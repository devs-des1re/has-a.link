import t from "ava";
import fs from "fs-extra";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  validateTemplate,
  collectTemplateComments,
  checkboxStatus,
  extractSection
} = require("../utils/check-pr-template.cjs");

const template = fs.readFileSync(path.resolve(".github", "PULL_REQUEST_TEMPLATE.md"), "utf8");

function checkedTemplate() {
  return template.replace(/- \[ \]/g, "- [x]");
}

function fillSection(body, heading, content) {
  return body.replace(new RegExp(`(##\\s*${heading}\\s*\\n)`), `$1${content}\n`);
}

const goodPreview = "- Link: https://myname.has-a.link\n- Screenshot: https://i.imgur.com/abc.png";
const goodPurpose = "A personal portfolio showcasing my projects.";

function completeBody() {
  let body = checkedTemplate();
  body = fillSection(body, "Website Preview", goodPreview);
  body = fillSection(body, "Website Purpose", goodPurpose);
  return body;
}

t("a fully completed template passes", (t) => {
  t.deepEqual(validateTemplate(completeBody()), []);
});

t("template with placeholder text only fails both sections", (t) => {
  const errors = validateTemplate(checkedTemplate());

  t.true(errors.some((e) => e.includes("Website Preview")));
  t.true(errors.some((e) => e.includes("Website Purpose")));
});

t("deleted closing marker no longer breaks detection (heading fallback)", (t) => {
  const body = completeBody().replace("<!-- WEBSITE_PURPOSE_END -->", "");

  t.deepEqual(validateTemplate(body), []);
});

t("user response in Purpose without closing marker is accepted", (t) => {
  const body = checkedTemplate().replace("<!-- WEBSITE_PURPOSE_END -->", "sdsadsadsa");

  const errors = validateTemplate(body);

  t.false(errors.some((e) => e.includes("Website Purpose")));
});

t("unchecked box is reported", (t) => {
  const body = completeBody().replace("- [x] <!-- TOS --> I have read", "- [ ] <!-- TOS --> I have read");

  t.true(validateTemplate(body).some((e) => e.includes("TOS")));
});

t("missing requirement line is reported", (t) => {
  const body = completeBody()
    .split(/\r?\n/)
    .filter((line) => !/TOS/.test(line))
    .join("\n");

  t.true(validateTemplate(body).some((e) => e.includes("TOS") && e.includes("missing")));
});

t("fully removed template is reported", (t) => {
  const errors = validateTemplate("Just a description with no template.");

  t.true(errors.some((e) => e.includes("removed or replaced")));
});

t("placeholder lines come from the template comments", (t) => {
  const placeholders = collectTemplateComments(template);

  t.true(placeholders.has("Briefly describe what your website is and what it is used for."));
});

t("checkboxStatus distinguishes checked, unchecked, missing", (t) => {
  const checkbox = { id: "TOS", match: /terms of service/i };

  t.is(checkboxStatus(checkedTemplate(), checkbox), "checked");
  t.is(checkboxStatus(template, checkbox), "unchecked");
  t.is(checkboxStatus("nothing here", checkbox), "missing");
});

t("section extraction prefers the heading when markers are removed", (t) => {
  const body = checkedTemplate().replace(/<!-- WEBSITE_[A-Z_]+ -->/g, "");
  body.replace("## Website Purpose", "## Website Purpose");

  const result = extractSection(
    body,
    { name: "Website Purpose", heading: "website purpose" },
    collectTemplateComments(template)
  );

  t.true(result.found);
});
