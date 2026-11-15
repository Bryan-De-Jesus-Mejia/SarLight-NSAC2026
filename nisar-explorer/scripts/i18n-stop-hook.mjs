/**
 * Claude Code "Stop" hook: before the assistant ends its turn, check that every
 * sentence marked for translation has Spanish. If something is missing it exits
 * with code 2 and prints what to add, so the assistant keeps going until the
 * change ships ready for both languages.
 *
 * It never blocks twice in a row (stop_hook_active), so it cannot loop.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  // No JSON on stdin: run the check anyway.
}
if (input.stop_hook_active) process.exit(0);

const here = dirname(fileURLToPath(import.meta.url));
const run = (script) => spawnSync(process.execPath, [join(here, script)], { encoding: "utf8" });
// The sentences in the code, and the names of the cases the pipeline adds.
const result = [run("check-i18n.mjs"), run("check-case-names.mjs")].find((r) => r.status !== 0) ?? { status: 0 };

if (result.status === 0) process.exit(0);

process.stderr.write(
  `Faltan traducciones al español (regla del proyecto: .claude/rules/i18n.md).\n` +
    `Agrega cada frase a nisar-explorer/i18n/es/ con la clave idéntica al inglés y corre \`node scripts/check-i18n.mjs --raw\`.\n\n` +
    `${result.stdout}${result.stderr}`,
);
process.exit(2);
