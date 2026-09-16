// Lightweight publish guard: the CLI has no dedicated test suite (the API's
// `npm test` lives in ../api and isn't part of this package), so this
// dynamically imports every source module to catch syntax errors, bad imports,
// or module-load-time exceptions before `npm publish` can ship them.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = resolve(import.meta.dirname, '..', 'src');

function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = collectJsFiles(SRC).filter((f) => !f.endsWith(join('src', 'index.js')));
// index.js is excluded because importing it runs program.parseAsync(); every
// module it wires up (commands/*, lib/*) is imported below instead.

let failed = false;
for (const file of files) {
  try {
    await import(pathToFileURL(file).href);
  } catch (err) {
    failed = true;
    console.error(`✖ ${file}\n  ${err?.stack ?? err}`);
  }
}

if (failed) {
  console.error('\nprepublish check failed — fix the errors above before publishing.');
  process.exit(1);
}
console.log(`✔ prepublish check passed (${files.length} modules imported cleanly)`);
