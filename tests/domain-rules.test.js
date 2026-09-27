import t from "ava";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const rules = require("../utils/domain-rules.cjs");

const reserved = require("../utils/reserved.json");
const internal = require("../utils/internal.json");
const disallowedCNAMEs = require("../utils/disallowed-cnames.json");

function validate(filename, data, raw = JSON.stringify(data)) {
  const subdomain = filename.replace(/\.json$/, "");
  return rules.validateDomainFile({ subdomain, raw, data, reserved, internal, disallowedCNAMEs });
}

t("valid CNAME registration has no findings", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev" },
    proxied: true
  });

  t.deepEqual(findings, []);
});

t("uppercase subdomain is rejected", (t) => {
  const findings = validate("MyName.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev" }
  });

  t.true(findings.some((f) => f.problem.includes("uppercase")));
});

t("reserved subdomain is rejected", (t) => {
  const findings = validate("admin.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev" }
  });

  t.true(findings.some((f) => f.problem.includes("reserved")));
});

t("consecutive hyphens are rejected", (t) => {
  const findings = validate("my--name.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev" }
  });

  t.true(findings.some((f) => f.problem.includes("consecutive hyphens")));
});

t("missing owner email is reported with a fix", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname" },
    records: { CNAME: "example.pages.dev" }
  });

  const finding = findings.find((f) => f.path === "owner.email");

  t.truthy(finding);
  t.true(finding.problem.includes("required"));
  t.true(typeof finding.fix === "string" && finding.fix.length > 0);
});

t("github noreply email is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "myname@users.noreply.github.com" },
    records: { CNAME: "example.pages.dev" }
  });

  t.true(findings.some((f) => f.problem.includes("no-reply")));
});

t("private IP is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { A: ["10.0.0.1"] }
  });

  t.true(findings.some((f) => f.problem.includes("IPv4")));
});

t("self-referencing CNAME is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "myname.has-a.link" }
  });

  t.true(findings.some((f) => f.problem.includes("itself")));
});

t("disallowed CNAME suffix is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "evil.workers.dev" }
  });

  t.true(findings.some((f) => f.problem.includes("subdomain takeover")));
});

t("unsupported record type is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { MX: ["mail.example.com"] }
  });

  t.true(findings.some((f) => f.problem.includes("not a supported record type")));
});

t("CNAME combined with TXT without proxied is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev", TXT: "hello" }
  });

  t.true(findings.some((f) => f.problem.includes("cannot be combined")));
});

t("proxied requires a proxy-able record", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { TXT: "hello" },
    proxied: true
  });

  t.true(findings.some((f) => f.problem.includes("no records that can be proxied")));
});

t("root subdomain with only TXT is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { TXT: "hello" }
  });

  t.true(findings.some((f) => f.problem.includes("root subdomain")));
});

t("nested TXT-only subdomain is allowed", (t) => {
  const findings = validate("_vercel.myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { TXT: "vc-domain-verify=myname.has-a.link,abc123" }
  });

  t.deepEqual(findings, []);
});

t("blocked fields are rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { CNAME: "example.pages.dev" },
    domain: "evil.has-a.link"
  });

  t.true(findings.some((f) => f.problem.includes("`domain` field is not allowed")));
});

t("invalid JSON is reported", (t) => {
  const subdomain = "myname";

  const findings = rules.validateDomainFile({
    subdomain,
    raw: "{ not valid",
    data: null,
    reserved,
    internal,
    disallowedCNAMEs
  });

  t.true(findings.some((f) => f.problem.includes("not a valid hostname") || f.problem.includes("JSON object")));
});

t("duplicate keys are detected", (t) => {
  const raw = '{"owner":{"username":"a","username":"b"},"records":{"CNAME":"x.pages.dev"}}';
  const data = { owner: { username: "a" }, records: { CNAME: "x.pages.dev" } };

  const findings = rules.validateDomainFile({ subdomain: "myname", raw, data, reserved, internal, disallowedCNAMEs });

  t.true(findings.some((f) => f.problem.includes("Duplicate JSON keys")));
});

t("TXT longer than 255 characters is rejected", (t) => {
  const findings = validate("myname.json", {
    owner: { username: "myname", email: "me@example.com" },
    records: { TXT: "a".repeat(300) }
  });

  t.true(findings.some((f) => f.problem.includes("255 characters")));
});
