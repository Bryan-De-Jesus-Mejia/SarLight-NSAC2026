/**
 * Every case the pipeline adds (data/analysis/*.json) brings a name, a region and a
 * country in English. This checks that each one has its Spanish in i18n/es/ —
 * as an entry, or in the list of names that read the same in both languages.
 * Exits with 1 and lists what is missing, so a new case never reaches the site
 * half translated.
 *
 *   node scripts/check-case-names.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const esDir = join(root, "i18n", "es");

const source = readdirSync(esDir)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => readFileSync(join(esDir, file), "utf8"))
  .join("\n");

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const quoted = (text) => escape(JSON.stringify(text).slice(1, -1));

function translated(text) {
  const key = new RegExp(`^\\s*(?:"${quoted(text)}"|${escape(text)})\\s*:`, "m");
  const sameInBoth = new RegExp(`^\\s*"${quoted(text)}",\\s*$`, "m");
  return key.test(source) || sameInBoth.test(source);
}

const missing = new Map();
for (const file of ["cases.json", "extra.json"]) {
  const { cases } = JSON.parse(readFileSync(join(root, "data", "analysis", file), "utf8"));
  for (const item of cases) {
    for (const field of ["name", "region", "country"]) {
      const value = item[field];
      if (!value) continue;
      if (translated(value) || translated(value.replace(/ analysis$/, ""))) continue;
      if (!missing.has(field)) missing.set(field, new Set());
      missing.get(field).add(value);
    }
  }
}

let total = 0;
for (const [field, values] of missing) {
  total += values.size;
  console.log(`${field}: ${values.size} sin español`);
  for (const value of [...values].sort()) console.log(`  "${value}"`);
}
if (total > 0) {
  console.log(`\nAgrega esas frases en nisar-explorer/i18n/es/data.ts (con su traducción, o en la lista de nombres que no cambian).`);
  process.exit(1);
}
console.log("Case names: all translated.");
