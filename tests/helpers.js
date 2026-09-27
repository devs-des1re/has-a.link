import fs from "fs-extra";
import path from "path";

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

export const validRecordTypes = new Set(["A", "AAAA", "CNAME", "TXT"]);

export const hostnameRegex = /^(?=.{1,253}$)(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)\.)+[a-zA-Z]{2,63}$/;

export const ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;

export const ipv6Regex =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

export function expandIPv6(ip) {
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

export function isValidIPv4(ip) {
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

export function isValidIPv6(ip) {
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

export function isValidHostname(hostname) {
  return hostnameRegex.test(hostname);
}
