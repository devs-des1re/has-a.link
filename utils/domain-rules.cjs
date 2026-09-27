"use strict";

const validRecordTypes = new Set(["A", "AAAA", "CNAME", "TXT"]);

const hostnameRegex = /^(?=.{1,253}$)(?:(?:[_a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,63}$/;

const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;

const ipv6Regex =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const requiredTopFields = { owner: "object", records: "object" };
const optionalTopFields = { proxied: "boolean" };
const requiredOwnerFields = { username: "string", email: "string" };

const blockedFields = [
  "domain",
  "internal",
  "proxy",
  "reserved",
  "services",
  "subdomain",
  "subdomains",
  "nested",
  "record",
  "__proto__",
  "constructor",
  "prototype"
];

const usableRecordTypes = ["A", "AAAA", "CNAME"];

function expandIPv6(ip) {
  let segments = ip.split(":");
  const emptyIndex = segments.indexOf("");

  if (emptyIndex !== -1) {
    const nonEmptySegments = segments.filter((seg) => seg !== "");
    const missingSegments = 8 - nonEmptySegments.length;

    segments = [
      ...nonEmptySegments.slice(0, emptyIndex),
      ...Array(missingSegments).fill("0000"),
      ...nonEmptySegments.slice(emptyIndex)
    ];
  }

  return segments.map((segment) => segment.padStart(4, "0")).join(":");
}

function isValidIPv4(ip) {
  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split(".").map(Number);

  return !(
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) ||
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
    (parts[0] === 198 && parts[1] === 18) ||
    (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
    parts[0] >= 224
  );
}

function isValidIPv6(ip) {
  const expanded = expandIPv6(ip);

  if (!ipv6Regex.test(expanded)) return false;

  const lower = expanded.toLowerCase();

  return !(
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower === "0000:0000:0000:0000:0000:0000:0000:0001" ||
    lower.startsWith("2001:0db8")
  );
}

function isValidHostname(hostname) {
  return typeof hostname === "string" && hostnameRegex.test(hostname);
}

function findDuplicateKeys(jsonString) {
  const duplicateKeys = new Set();
  const scopes = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;

  const skipWhitespace = (from) => {
    let j = from;
    while (j < jsonString.length && /\s/.test(jsonString[j])) j++;
    return j;
  };

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;

        const after = skipWhitespace(i + 1);

        if (jsonString[after] === ":" && scopes.length > 0) {
          const key = JSON.parse(jsonString.slice(stringStart, i + 1));

          const scope = scopes[scopes.length - 1];

          if (scope.has(key)) {
            duplicateKeys.add(key);
          } else {
            scope.add(key);
          }
        }
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      escaped = false;
      stringStart = i;
      continue;
    }

    if (char === "{") {
      scopes.push(new Set());
      continue;
    }

    if (char === "}") {
      scopes.pop();
    }
  }

  return [...duplicateKeys];
}

function validateSubdomainName(subdomain, { reserved = [], internal = [] } = {}) {
  const findings = [];

  const add = (path, problem, fix) => findings.push({ path, problem, fix });

  if (subdomain.length === 0) {
    add(subdomain, "The file name is empty.", "Name your file after the subdomain you want, e.g. `my-name.json`.");
    return findings;
  }

  if (subdomain !== subdomain.toLowerCase()) {
    add(subdomain, "The name contains uppercase characters.", "Use lowercase only, e.g. `my-name.json`.");
  }

  if (subdomain.includes("--")) {
    add(subdomain, "The name contains consecutive hyphens (`--`).", "Use single hyphens as separators.");
  }

  if (subdomain.startsWith(".")) {
    add(subdomain, "The name starts with a dot.", "Remove the leading dot.");
  }

  if (reserved.includes(subdomain) || internal.includes(subdomain)) {
    add(subdomain, "This name is reserved and cannot be registered.", "Choose a different name.");
  }

  const root = subdomain.split(".").pop();

  if (root.startsWith("_")) {
    add(subdomain, "The root label starts with an underscore.", "Only prefixes like `_vercel` may use underscores.");
  }

  if (root.includes("has-a-link")) {
    add(subdomain, "The name contains the reserved string `has-a-link`.", "Choose a different name.");
  }

  if (subdomain.split(".").some((label) => label.length > 63)) {
    add(
      subdomain,
      "A label is longer than 63 characters.",
      "Shorten each dot-separated label to 63 characters or fewer."
    );
  }

  if (subdomain.length > 244) {
    add(subdomain, "The name is longer than 244 characters.", "Shorten the name.");
  }

  if (!hostnameRegex.test(`${subdomain}.has-a.link`)) {
    add(
      subdomain,
      "The name is not a valid hostname.",
      "Use only letters, numbers, dots, and non-consecutive hyphens."
    );
  }

  return findings;
}

function validateOwner(data) {
  const findings = [];
  const add = (path, problem, fix) => findings.push({ path, problem, fix });

  if (typeof data.owner !== "object" || data.owner === null || Array.isArray(data.owner)) {
    add(
      "owner",
      "The `owner` field is missing or is not an object.",
      "Add an `owner` object with `username` and `email`."
    );
    return findings;
  }

  for (const field of Object.keys(requiredOwnerFields)) {
    if (!(field in data.owner)) {
      add(`owner.${field}`, `The \`owner.${field}\` field is required.`, `Add \`owner.${field}\`.`);
    }
  }

  if ("username" in data.owner && typeof data.owner.username !== "string") {
    add("owner.username", "`owner.username` must be a string.", "Use your GitHub username.");
  }

  if ("email" in data.owner && typeof data.owner.email !== "string") {
    add("owner.email", "`owner.email` must be a string.", "Use a real email address.");
  }

  if (typeof data.owner.email === "string") {
    if (!emailRegex.test(data.owner.email)) {
      add("owner.email", "`owner.email` is not a valid email address.", "Use a valid email address.");
    } else if (data.owner.email.endsWith("@users.noreply.github.com")) {
      add(
        "owner.email",
        "`owner.email` cannot be a GitHub no-reply address.",
        "Provide a real, contactable email address."
      );
    }
  }

  return findings;
}

function validateRecords(data, subdomain, { disallowedCNAMEs = [] } = {}) {
  const findings = [];
  const add = (path, problem, fix) => findings.push({ path, problem, fix });

  if (typeof data.records !== "object" || data.records === null || Array.isArray(data.records)) {
    add(
      "records",
      "The `records` field is missing or is not an object.",
      "Add a `records` object with at least one record."
    );
    return findings;
  }

  const recordKeys = Object.keys(data.records);

  if (recordKeys.length === 0) {
    add("records", "No DNS records were provided.", "Add at least one record, such as `CNAME` or `A`.");
    return findings;
  }

  for (const key of recordKeys) {
    if (!validRecordTypes.has(key)) {
      add(
        `records.${key}`,
        `\`${key}\` is not a supported record type.`,
        `Use one of: ${[...validRecordTypes].join(", ")}.`
      );
    }
  }

  if (recordKeys.includes("A")) {
    const value = data.records.A;

    if (!Array.isArray(value)) {
      add("records.A", "`A` records must be an array.", 'Example: `"A": ["203.0.113.10"]`.');
    } else {
      value.forEach((record, idx) => {
        if (typeof record !== "string" || !isValidIPv4(record)) {
          add(
            `records.A[${idx}]`,
            `\`${record}\` is not a valid public IPv4 address.`,
            "Use a routable public IPv4 address; private and reserved ranges are rejected."
          );
        }
      });
    }
  }

  if (recordKeys.includes("AAAA")) {
    const value = data.records.AAAA;

    if (!Array.isArray(value)) {
      add("records.AAAA", "`AAAA` records must be an array.", 'Example: `"AAAA": ["2606:4700::1"]`.');
    } else {
      value.forEach((record, idx) => {
        if (typeof record !== "string" || !isValidIPv6(record)) {
          add(
            `records.AAAA[${idx}]`,
            `\`${record}\` is not a valid public IPv6 address.`,
            "Use a routable public IPv6 address; private and reserved ranges are rejected."
          );
        }
      });
    }
  }

  if (recordKeys.includes("CNAME")) {
    const value = data.records.CNAME;

    if (typeof value !== "string") {
      add("records.CNAME", "`CNAME` must be a single string.", 'Example: `"CNAME": "example.pages.dev"`.');
    } else if (!isValidHostname(value)) {
      add("records.CNAME", `\`${value}\` is not a valid hostname.`, "Use a valid hostname, e.g. `example.pages.dev`.");
    } else {
      if (value === `${subdomain}.has-a.link`) {
        add("records.CNAME", "`CNAME` cannot point to itself.", "Point it at your hosting provider's target.");
      }

      if (value === "has-a.link") {
        add("records.CNAME", "`CNAME` cannot point to `has-a.link`.", "Point it at your hosting provider's target.");
      }

      for (const disallowed of disallowedCNAMEs) {
        const blocked = disallowed.startsWith(".") ? value.endsWith(disallowed) : value === disallowed;
        if (blocked) {
          add(
            "records.CNAME",
            `\`CNAME\` target \`${value}\` is disallowed because it is prone to subdomain takeover.`,
            "Use your provider's dedicated target hostname instead."
          );
        }
      }
    }
  }

  if (recordKeys.includes("TXT")) {
    const values = Array.isArray(data.records.TXT) ? data.records.TXT : [data.records.TXT];

    values.forEach((record, idx) => {
      if (typeof record !== "string") {
        add(`records.TXT[${idx}]`, "TXT values must be strings.", "Wrap the value in quotes.");
      } else if (record.length > 255) {
        add(
          `records.TXT[${idx}]`,
          "A TXT value is longer than 255 characters.",
          "Split the value into an array of 255-character chunks."
        );
      }
    });
  }

  if (recordKeys.includes("CNAME")) {
    if (!data.proxied && recordKeys.length > 1) {
      add(
        "records",
        "A `CNAME` cannot be combined with other records unless the domain is proxied.",
        'Remove the other records, or set `"proxied": true`.'
      );
    }

    if (data.proxied && (recordKeys.includes("A") || recordKeys.includes("AAAA"))) {
      add(
        "records",
        "A proxied `CNAME` cannot be combined with `A` or `AAAA` records.",
        "Remove the `A`/`AAAA` records."
      );
    }
  }

  if (data.proxied) {
    const hasProxyable = recordKeys.some((key) => usableRecordTypes.includes(key));
    if (!hasProxyable) {
      add(
        "proxied",
        "`proxied` is true but there are no records that can be proxied.",
        "Proxy requires at least one `A`, `AAAA`, or `CNAME` record."
      );
    }
  }

  const isRoot = !subdomain.includes(".") && !subdomain.startsWith("_");

  if (isRoot && !usableRecordTypes.some((type) => recordKeys.includes(type))) {
    add(
      "records",
      "A root subdomain must have at least one `A`, `AAAA`, or `CNAME` record.",
      "Add a web record, or use a nested name such as `sub.yourname` for TXT-only setups."
    );
  }

  return findings;
}

function validateDomainFile({ subdomain, raw, data, reserved = [], internal = [], disallowedCNAMEs = [] }) {
  const findings = [];
  const add = (path, problem, fix) => findings.push({ path, problem, fix });

  if (typeof raw === "string") {
    const duplicates = findDuplicateKeys(raw);
    if (duplicates.length) {
      add(subdomain, `Duplicate JSON keys found: ${duplicates.join(", ")}.`, "Remove the duplicate keys.");
    }
  }

  findings.push(...validateSubdomainName(subdomain, { reserved, internal }));

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    add(subdomain, "The file must contain a JSON object.", "See the documentation for the expected structure.");
    return findings;
  }

  for (const field of blockedFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      add(field, `The \`${field}\` field is not allowed.`, "Remove this field.");
    }
  }

  findings.push(...validateOwner(data));
  findings.push(...validateRecords(data, subdomain, { disallowedCNAMEs }));

  return findings;
}

module.exports = {
  validRecordTypes,
  hostnameRegex,
  ipv4Regex,
  ipv6Regex,
  emailRegex,
  blockedFields,
  expandIPv6,
  isValidIPv4,
  isValidIPv6,
  isValidHostname,
  findDuplicateKeys,
  validateSubdomainName,
  validateOwner,
  validateRecords,
  validateDomainFile
};
