/**
 * Lists the English sentences the code asks to translate (t("…"), tr("…"),
 * msg("…")) that have no Spanish yet, and the Spanish entries nothing uses.
 *
 *   node scripts/check-i18n.mjs          # report, exit 1 if anything is missing
 *   node scripts/check-i18n.mjs --unused # also list entries nothing refers to
 *   node scripts/check-i18n.mjs --raw    # also list English text written straight into JSX (not wrapped in t())
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["app", "components", "lib", "data", "store", "hooks", "i18n"];
const CALLEES = new Set(["t", "tr", "msg"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "es" && dir.endsWith("i18n")) continue; // the dictionary itself
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** The Spanish dictionary: every file in i18n/es except index.ts, run as a module. */
function loadSpanish() {
  const dir = join(root, "i18n", "es");
  const merged = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "index.ts") continue;
    const source = readFileSync(join(dir, name), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} };
    new Function("module", "exports", js)(mod, mod.exports);
    for (const value of Object.values(mod.exports)) Object.assign(merged, value);
  }
  return merged;
}

const spanish = loadSpanish();
const used = new Map(); // sentence → first place it is used
const dynamic = [];
const raw = [];
const ATTRS = new Set(["aria-label", "title", "placeholder", "alt"]);

for (const base of SOURCE_DIRS) {
  let files = [];
  try {
    files = walk(join(root, base));
  } catch {
    continue;
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, kind);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && CALLEES.has(node.expression.text)) {
        const arg = node.arguments[0];
        const where = `${relative(root, file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
          if (!used.has(arg.text)) used.set(arg.text, where);
        } else if (arg && ts.isTemplateExpression(arg)) {
          dynamic.push(where);
        }
      }
      if (ts.isJsxText(node)) {
        const text = node.getText().replace(/\s+/g, " ").trim();
        if (/[A-Za-z]{3,} [A-Za-z]{2,}/.test(text) && !text.startsWith("{")) {
          raw.push(`${relative(root, file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}  ${text.slice(0, 70)}`);
        }
      }
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText())) {
        if (/[A-Za-z]{3,}/.test(node.initializer.text)) {
          raw.push(`${relative(root, file)}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}  ${node.name.getText()}="${node.initializer.text.slice(0, 60)}"`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

const missing = [...used].filter(([text]) => spanish[text] === undefined);
console.log(`${used.size} sentences used, ${Object.keys(spanish).length} in Spanish, ${missing.length} missing.`);
for (const [text, where] of missing) console.log(`  MISSING  ${where}\n           ${JSON.stringify(text)}`);

if (dynamic.length) {
  console.log(`\nTemplate strings passed to t() cannot be looked up (use {name} placeholders instead):`);
  for (const where of dynamic) console.log(`  ${where}`);
}

if (process.argv.includes("--raw")) {
  console.log(`
${raw.length} English texts written straight into JSX (wrap them with t()):`);
  for (const line of raw) console.log(`  ${line}`);
}

if (process.argv.includes("--unused")) {
  const unused = Object.keys(spanish).filter((text) => !used.has(text));
  console.log(`\n${unused.length} Spanish entries not referenced by a literal t()/msg() call (some are looked up by name):`);
  for (const text of unused) console.log(`  ${JSON.stringify(text)}`);
}

process.exit(missing.length || dynamic.length ? 1 : 0);
