import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const domainsPath = path.join(root, "domains");

const knownTakeoverSuffixes = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, "disallowed-cnames.json"), "utf8"))
);

export function extractCnames() {
  const files = fs
    .readdirSync(domainsPath)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.startsWith("_vercel."))
    .sort();

  const entries = [];

  for (const file of files) {
    const subdomain = file.replace(/\.json$/, "");
    let data;

    try {
      data = JSON.parse(fs.readFileSync(path.join(domainsPath, file), "utf8"));
    } catch {
      continue;
    }

    if (data.records && typeof data.records.CNAME === "string") {
      entries.push({ subdomain, target: data.records.CNAME.toLowerCase() });
    }
  }

  return entries;
}

export function classifyResolution({ target, status, addresses, errorCode }) {
  if (status === "resolved" && addresses && addresses.length > 0) {
    return { target, state: "ok" };
  }

  if (status === "resolved") {
    return { target, state: "ok" };
  }

  if (errorCode === "ENOTFOUND" || errorCode === "ENODATA") {
    return { target, state: "dangling" };
  }

  if (errorCode === "SERVFAIL" || errorCode === "ETIMEOUT" || errorCode === "EAI_AGAIN") {
    return { target, state: "transient" };
  }

  return { target, state: "unknown", errorCode };
}

export function isKnownTakeoverTarget(target) {
  for (const suffix of knownTakeoverSuffixes) {
    if (target.endsWith(suffix)) return true;
  }

  return false;
}

async function resolveTarget(target) {
  const errors = [];

  for (const resolver of [dns.resolveCname, dns.resolve4, dns.resolve6]) {
    try {
      const addresses = await resolver(target);
      return classifyResolution({ target, status: "resolved", addresses });
    } catch (error) {
      errors.push(error.code || error.message);
    }
  }

  return classifyResolution({ target, status: "unresolved", errorCode: errors[0] });
}

export async function scan({ resolve = resolveTarget } = {}) {
  const entries = extractCnames();
  const results = [];

  for (const entry of entries) {
    const resolution = await resolve(entry.target);
    const flagged = resolution.state === "dangling";

    results.push({
      subdomain: entry.subdomain,
      domain: `${entry.subdomain}.has-a.link`,
      target: entry.target,
      knownTakeoverTarget: isKnownTakeoverTarget(entry.target),
      ...resolution,
      flagged
    });
  }

  return results;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const results = await scan();
  const flagged = results.filter((result) => result.flagged);

  const report = {
    scannedAt: new Date().toISOString(),
    total: results.length,
    flagged: flagged.length,
    findings: flagged
  };

  const outputIndex = process.argv.indexOf("--output");

  if (outputIndex !== -1 && process.argv[outputIndex + 1]) {
    fs.writeFileSync(path.resolve(process.argv[outputIndex + 1]), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(report, null, 2));

  if (flagged.length > 0 && process.argv.includes("--fail")) {
    process.exit(1);
  }
}
