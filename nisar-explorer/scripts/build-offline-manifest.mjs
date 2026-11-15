/**
 * Lists, for every case, the files the app needs to show it without a connection and
 * how many bytes they weigh, so the "Work offline" panel can say what a download costs
 * before it starts. Written to public/offline-manifest.json; runs before `dev` and `build`.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = /^\/analysis(?:-extra)?\/.+\.(?:webp|png|jpe?g)$/i;

function collect(value, found) {
  if (typeof value === "string") {
    if (IMAGE.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collect(item, found);
  }
}

const cases = {};
for (const file of ["cases.json", "extra.json"]) {
  const { cases: list } = JSON.parse(readFileSync(join(root, "data", "analysis", file), "utf8"));
  for (const item of list) {
    const found = new Set();
    collect(item, found);
    let bytes = Math.round(Buffer.byteLength(JSON.stringify(item)) * 1.15); // the detail the API sends
    const files = [];
    for (const path of found) {
      const full = join(root, "public", path);
      if (!existsSync(full)) continue;
      bytes += statSync(full).size;
      files.push(path);
    }
    cases[item.id] = { bytes, files: files.sort(), country: item.country };
  }
}

writeFileSync(join(root, "public", "offline-manifest.json"), JSON.stringify({ cases }));
console.log(`offline manifest: ${Object.keys(cases).length} cases`);
