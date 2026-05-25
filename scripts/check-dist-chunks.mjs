import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve("dist/assets");
const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => {
  throw new Error("Missing dist/assets. Run vite build before check:dist.");
});

const jsFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  .map((entry) => entry.name)
  .sort();

if (jsFiles.length === 0) {
  throw new Error("No JavaScript chunks found in dist/assets.");
}

const jsFileSet = new Set(jsFiles);
const graph = new Map(jsFiles.map((file) => [file, new Set()]));
const importPatterns = [
  /\bimport(?:[\w\s{},*$]+from)?["'](\.\/[^"']+\.js)["']/g,
  /\bexport(?:[\w\s{},*$]+from)["'](\.\/[^"']+\.js)["']/g,
];

for (const file of jsFiles) {
  const source = await readFile(path.join(assetsDir, file), "utf8");
  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const importedFile = path.basename(match[1]);
      if (jsFileSet.has(importedFile)) {
        graph.get(file).add(importedFile);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];

function findCycle(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    return [...stack.slice(start), file];
  }
  if (visited.has(file)) return null;

  visiting.add(file);
  stack.push(file);

  for (const dependency of graph.get(file)) {
    const cycle = findCycle(dependency);
    if (cycle) return cycle;
  }

  stack.pop();
  visiting.delete(file);
  visited.add(file);
  return null;
}

for (const file of jsFiles) {
  const cycle = findCycle(file);
  if (cycle) {
    throw new Error(
      `Circular JavaScript chunk import detected:\n${cycle
        .map((chunk) => `  ${chunk}`)
        .join("\n  -> ")}\nThis can pass compilation but fail at runtime in browsers.`
    );
  }
}

console.log(`No circular JavaScript chunk imports detected across ${jsFiles.length} chunks.`);
