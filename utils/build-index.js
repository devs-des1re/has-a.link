import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const domainsPath = path.join(root, "domains");
const outputPath = path.join(root, "domains.json");

const checkOnly = process.argv.includes("--check");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function buildIndex() {
  const files = fs
    .readdirSync(domainsPath)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.startsWith("_vercel."))
    .sort();

  const index = {};

  for (const file of files) {
    const subdomain = file.replace(/\.json$/, "");
    const data = readJson(path.join(domainsPath, file));

    index[subdomain] = data.owner.username;
  }

  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));

  return `${JSON.stringify(sorted, null, 2)}\n`;
}

const expected = buildIndex();

if (checkOnly) {
  const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

  if (actual !== expected) {
    console.error("domains.json is out of date. Run `npm run index` and commit the result.");
    process.exit(1);
  }

  console.log("domains.json is up to date.");
  process.exit(0);
}

fs.writeFileSync(outputPath, expected, "utf8");
console.log(`Wrote ${Object.keys(JSON.parse(expected)).length} entries to domains.json`);
