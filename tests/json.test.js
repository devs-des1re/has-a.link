import t from "ava";
import fs from "fs-extra";
import path from "path";

import internalDomains from "../utils/internal.json" with { type: "json" };
import reservedDomains from "../utils/reserved.json" with { type: "json" };
import { domainsPath, files } from "./helpers.js";

const ignoredRootJSONFiles = ["package-lock.json", "package.json", "domains.json"];

const requiredFields = {
  owner: "object",
  records: "object"
};

const optionalFields = {
  proxied: "boolean"
};

const requiredOwnerFields = {
  username: "string",
  email: "string"
};

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

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function findDuplicateKeys(jsonString) {
  const duplicateKeys = new Set();
  const keyStack = [];

  const keyRegex = /"(.*?)"\s*:/g;

  let i = 0;
  while (i < jsonString.length) {
    const char = jsonString[i];

    if (char === "{") {
      keyStack.push({});
      i++;
      continue;
    }

    if (char === "}") {
      keyStack.pop();
      i++;
      continue;
    }

    keyRegex.lastIndex = i;
    const match = keyRegex.exec(jsonString);
    if (match && match.index === i && keyStack.length > 0) {
      const key = match[1];
      const currentScope = keyStack[keyStack.length - 1];

      if (currentScope[key]) {
        duplicateKeys.add(key);
      } else {
        currentScope[key] = true;
      }

      i = keyRegex.lastIndex;
    } else {
      i++;
    }
  }

  return [...duplicateKeys];
}

function validateFields(t, obj, fields, file, prefix = "") {
  for (const key of Object.keys(fields)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (obj.hasOwnProperty(key)) {
      t.is(typeof obj[key], fields[key], `${file}: Field ${fieldPath} should be of type ${fields[key]}`);
    } else if (fields === requiredFields || fields === requiredOwnerFields) {
      t.true(false, `${file}: Missing required field: ${fieldPath}`);
    }
  }
}

function validateFileName(t, file) {
  t.true(file.endsWith(".json"), `${file}: File does not have .json extension`);
  t.false(file.includes(".has-a.link"), `${file}: File name should not contain .has-a.link`);
  t.true(file === file.toLowerCase(), `${file}: File name should be all lowercase`);
  t.false(file.includes("--"), `${file}: File name should not contain consecutive hyphens`);

  const subdomain = file.replace(/\.json$/, "");

  t.false(internalDomains.includes(subdomain), `${file}: Subdomain name is registered internally`);
  t.false(reservedDomains.includes(subdomain), `${file}: Subdomain name is reserved`);
  t.true(!internalDomains.some((i) => subdomain.endsWith(`.${i}`)), `${file}: Subdomain name is registered internally`);
  t.true(!reservedDomains.some((r) => subdomain.endsWith(`.${r}`)), `${file}: Subdomain name is reserved`);

  const rootSubdomain = subdomain.split(".").pop();
  t.false(rootSubdomain.startsWith("_"), `${file}: Root subdomains should not start with an underscore`);
  t.false(rootSubdomain.includes("has-a-link"), `${file}: Root subdomains should not contain has-a-link`);
}

function processFile(file, t) {
  const filePath = path.join(domainsPath, file);
  const data = fs.readJsonSync(filePath);

  validateFileName(t, file);

  const rawData = fs.readFileSync(filePath, "utf8");
  const duplicateKeys = findDuplicateKeys(rawData);
  t.true(!duplicateKeys.length, `${file}: Duplicate keys found: ${duplicateKeys.join(", ")}`);

  validateFields(t, data, requiredFields, file);
  validateFields(t, data.owner, requiredOwnerFields, file, "owner");
  validateFields(t, data, optionalFields, file);

  t.regex(data.owner.email, emailRegex, `${file}: Owner email should be a valid email address`);
  t.false(
    data.owner.email.endsWith("@users.noreply.github.com"),
    `${file}: Owner email should not be a GitHub no-reply email`
  );

  t.true(Object.keys(data.records).length > 0, `${file}: Missing DNS records`);

  for (const field of blockedFields) {
    t.true(!Object.prototype.hasOwnProperty.call(data, field), `${file}: Disallowed field: ${field}`);
  }
}

t("JSON files should not be in the root directory", (t) => {
  const rootFiles = fs
    .readdirSync(path.resolve())
    .filter((file) => file.endsWith(".json") && !ignoredRootJSONFiles.includes(file));
  t.is(rootFiles.length, 0, "JSON files should not be in the root directory");
});

t("All files should be valid JSON", (t) => {
  files.forEach((file) => {
    t.notThrows(() => fs.readJsonSync(path.join(domainsPath, file)), `${file}: Invalid JSON file`);
  });
});

t("All files should have valid file names", (t) => {
  files.forEach((file) => validateFileName(t, file));
});

t("All files should have valid required and optional fields", (t) => {
  files.forEach((file) => processFile(file, t));
  t.pass();
});
