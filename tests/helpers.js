import fs from "fs-extra";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const rules = require("../utils/domain-rules.cjs");

export const domainsPath = path.resolve("domains");
export const files = fs.readdirSync(domainsPath).filter((file) => file.endsWith(".json"));

const domainCache = {};

export function getDomainData(file) {
  if (domainCache[file]) {
    return domainCache[file];
  }

  try {
    const data = fs.readJsonSync(path.join(domainsPath, file));
    domainCache[file] = data;
    return data;
  } catch (error) {
    throw new Error(`Failed to read JSON for ${file}: ${error.message}`);
  }
}

export const validRecordTypes = rules.validRecordTypes;
export const hostnameRegex = rules.hostnameRegex;
export const ipv4Regex = rules.ipv4Regex;
export const ipv6Regex = rules.ipv6Regex;
export const expandIPv6 = rules.expandIPv6;
export const isValidIPv4 = rules.isValidIPv4;
export const isValidIPv6 = rules.isValidIPv6;
export const isValidHostname = rules.isValidHostname;
