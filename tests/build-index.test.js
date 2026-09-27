import t from "ava";
import fs from "fs-extra";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const domainsPath = path.join(root, "domains");
const indexPath = path.join(root, "domains.json");

function computeIndex() {
  const files = fs
    .readdirSync(domainsPath)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.startsWith("_vercel."))
    .sort();

  const index = {};

  for (const file of files) {
    const data = fs.readJsonSync(path.join(domainsPath, file));
    index[file.replace(/\.json$/, "")] = data.owner.username;
  }

  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
}

t("Index contains an entry for every domain file", (t) => {
  const expected = computeIndex();

  for (const subdomain of Object.keys(expected)) {
    t.true(subdomain.length > 0);
    t.is(typeof expected[subdomain], "string");
  }
});

t("Index omits owner emails", (t) => {
  const expected = computeIndex();
  const serialized = JSON.stringify(expected);

  t.false(serialized.includes("@"), "Index must not contain email addresses");
  t.false(serialized.includes("email"), "Index must not contain an email field");
});

t("Index excludes _vercel verification files", (t) => {
  const expected = computeIndex();

  t.false(
    Object.keys(expected).some((key) => key.startsWith("_vercel.")),
    "Index must not list _vercel verification entries"
  );
});

t("Index is deterministic and sorted", (t) => {
  const keys = Object.keys(computeIndex());
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));

  t.deepEqual(keys, sorted, "Index keys must be sorted");
});

t("--check fails when domains.json is stale", (t) => {
  const backup = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : null;

  try {
    fs.writeFileSync(indexPath, "{}\n", "utf8");

    t.throws(() =>
      execFileSync("node", [path.join(root, "utils", "build-index.js"), "--check"], {
        cwd: root,
        stdio: "pipe"
      })
    );
  } finally {
    if (backup === null) {
      fs.removeSync(indexPath);
    } else {
      fs.writeFileSync(indexPath, backup, "utf8");
    }
  }
});
