import t from "ava";

import disallowedCNAMEs from "../utils/disallowed-cnames.json" with { type: "json" };
import { files, getDomainData, validRecordTypes, isValidIPv4, isValidIPv6, isValidHostname } from "./helpers.js";

function validateRecordValues(t, data, file) {
  const subdomain = file.replace(/\.json$/, "");

  Object.entries(data.records).forEach(([key, value]) => {
    if (key === "A" || key === "AAAA") {
      t.true(Array.isArray(value), `${file}: Record value for ${key} should be an array`);

      value.forEach((record, idx) => {
        t.is(typeof record, "string", `${file}: Record value for ${key} should be a string at index ${idx}`);

        if (key === "A") {
          t.true(isValidIPv4(record), `${file}: Invalid IPv4 address for ${key} at index ${idx}`);
        } else {
          t.true(isValidIPv6(record), `${file}: Invalid IPv6 address for ${key} at index ${idx}`);
        }
      });
    }

    if (key === "CNAME") {
      t.is(typeof value, "string", `${file}: Record value for ${key} should be a string`);
      t.true(isValidHostname(value), `${file}: Invalid hostname for ${key}`);
      t.true(value !== `${subdomain}.has-a.link`, `${file}: ${key} cannot point to itself`);
      t.true(value !== "has-a.link", `${file}: ${key} cannot point to has-a.link`);

      for (const disallowed of disallowedCNAMEs) {
        if (disallowed.startsWith(".")) {
          t.false(value.endsWith(disallowed), `${file}: ${key} cannot end with ${disallowed}`);
        } else {
          t.false(value === disallowed, `${file}: ${key} cannot be ${disallowed}`);
        }
      }
    }

    if (key === "TXT") {
      const values = Array.isArray(value) ? value : [value];

      values.forEach((record, idx) => {
        t.is(typeof record, "string", `${file}: TXT record value should be a string at index ${idx}`);
        t.true(record.length <= 255, `${file}: TXT record value should be 255 characters or fewer at index ${idx}`);
      });
    }
  });
}

t("All files should have valid records", (t) => {
  files.forEach((file) => {
    const data = getDomainData(file);
    const recordKeys = Object.keys(data.records);

    recordKeys.forEach((key) => {
      t.true(validRecordTypes.has(key), `${file}: Invalid record type: ${key}`);
    });

    if (recordKeys.includes("CNAME")) {
      if (!data.proxied) {
        t.is(recordKeys.length, 1, `${file}: CNAME records cannot be combined with other records unless proxied`);
      } else {
        t.true(
          !recordKeys.includes("A") && !recordKeys.includes("AAAA"),
          `${file}: CNAME records cannot be combined with A or AAAA records`
        );
      }
    }

    validateRecordValues(t, data, file);
  });

  t.pass();
});

t("Root subdomains should have at least one usable record", (t) => {
  const usableRecordTypes = ["A", "AAAA", "CNAME"];

  files.forEach((file) => {
    const subdomain = file.replace(/\.json$/, "");
    if (subdomain.includes(".") || subdomain.startsWith("_")) return;

    const data = getDomainData(file);
    const recordKeys = Object.keys(data.records);

    t.true(
      usableRecordTypes.some((record) => recordKeys.includes(record)),
      `${file}: Root subdomains must have at least one A, AAAA, or CNAME record`
    );
  });
});
