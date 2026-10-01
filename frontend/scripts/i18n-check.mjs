// Vérifie que chaque texte passé à t("…") ou msg("…") a sa traduction anglaise.
// Usage : node scripts/i18n-check.mjs   (code de sortie 1 s'il manque des traductions)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sources = ["app", "components", "lib"].map((dir) => join(root, dir));
const dictionaryDir = join(root, "lib/i18n/messages/en");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

const dictionary = {};
for (const name of readdirSync(dictionaryDir).filter((file) => file.endsWith(".json"))) {
  const entries = JSON.parse(readFileSync(join(dictionaryDir, name), "utf8"));
  for (const [key, value] of Object.entries(entries)) {
    if (key in dictionary && dictionary[key] !== value) console.warn(`Doublon contradictoire (${name}) : ${key}`);
    dictionary[key] = value;
  }
}

// Texte littéral de t(…), tr(…), msg(…) ou translate(langue, …), entre guillemets doubles ou simples.
const call = /\b(?:t|tr|msg|translate\(\s*\w+\s*,)\s*\(?\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
const missing = new Map();
const used = new Set();
for (const file of sources.flatMap((dir) => walk(dir))) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(call)) {
    const raw = match[1] ?? match[2];
    const text = JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`);
    used.add(text);
    if (!(text in dictionary)) {
      const where = relative(root, file).replace(/\\/g, "/");
      if (!missing.has(text)) missing.set(text, where);
    }
  }
}

const unused = Object.keys(dictionary).filter((key) => !used.has(key));
if (process.argv.includes("--unused") && unused.length) {
  console.log(`${unused.length} traduction(s) inutilisée(s) :`);
  for (const key of unused) console.log(`  ${JSON.stringify(key)}`);
}
if (missing.size) {
  console.log(`${missing.size} texte(s) sans traduction anglaise :`);
  for (const [text, where] of missing) console.log(`  ${where}  ${JSON.stringify(text)}`);
  process.exit(1);
}
console.log(`Traductions complètes : ${used.size} textes.`);
