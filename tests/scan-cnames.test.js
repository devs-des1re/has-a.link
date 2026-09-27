import t from "ava";
import { extractCnames, classifyResolution, isKnownTakeoverTarget } from "../utils/scan-cnames.js";

t("extractCnames returns subdomain and lowercased target", (t) => {
  const entries = extractCnames();

  t.true(Array.isArray(entries));

  for (const entry of entries) {
    t.is(typeof entry.subdomain, "string");
    t.is(typeof entry.target, "string");
    t.is(entry.target, entry.target.toLowerCase());
    t.false(entry.subdomain.startsWith("_vercel."));
  }
});

t("known takeover suffix detection", (t) => {
  t.true(isKnownTakeoverTarget("evil.workers.dev"));
  t.true(isKnownTakeoverTarget("foo.trycloudflare.com"));
  t.false(isKnownTakeoverTarget("app.pages.dev"));
  t.false(isKnownTakeoverTarget("example.com"));
});

t("classifyResolution flags ENOTFOUND as dangling", (t) => {
  t.deepEqual(classifyResolution({ target: "gone.example.com", status: "unresolved", errorCode: "ENOTFOUND" }), {
    target: "gone.example.com",
    state: "dangling"
  });
});

t("classifyResolution flags ENODATA as dangling", (t) => {
  t.is(classifyResolution({ target: "x.example.com", status: "unresolved", errorCode: "ENODATA" }).state, "dangling");
});

t("classifyResolution treats SERVFAIL and timeouts as transient", (t) => {
  t.is(classifyResolution({ target: "x.example.com", status: "unresolved", errorCode: "SERVFAIL" }).state, "transient");
  t.is(classifyResolution({ target: "x.example.com", status: "unresolved", errorCode: "ETIMEOUT" }).state, "transient");
  t.is(
    classifyResolution({ target: "x.example.com", status: "unresolved", errorCode: "EAI_AGAIN" }).state,
    "transient"
  );
});

t("classifyResolution treats resolved targets as ok", (t) => {
  t.is(classifyResolution({ target: "x.example.com", status: "resolved", addresses: ["1.2.3.4"] }).state, "ok");
});
