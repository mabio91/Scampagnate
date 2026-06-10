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
const jsSources = new Map();
const importPatterns = [
  /\bimport(?:[\w\s{},*$]+from)?["'](\.\/[^"']+\.js)["']/g,
  /\bexport(?:[\w\s{},*$]+from)["'](\.\/[^"']+\.js)["']/g,
];

for (const file of jsFiles) {
  const source = await readFile(path.join(assetsDir, file), "utf8");
  jsSources.set(file, source);
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

const autoReloadChunk = [...jsSources].find(
  ([, source]) =>
    /addEventListener\(\s*["']activated["']/.test(source) &&
    /window\.location\.reload\(\)/.test(source)
);

if (autoReloadChunk) {
  throw new Error(
    `PWA auto-reload handler detected in ${autoReloadChunk[0]}.\n` +
      `Do not use registerType: "autoUpdate" for this app: it can trap Safari in a service worker refresh loop.`
  );
}

const swPath = path.resolve("dist/sw.js");
const swSource = await readFile(swPath, "utf8").catch(() => {
  throw new Error("Missing dist/sw.js. Run vite build before check:dist.");
});

if (/clients\.claim\s*\(/.test(swSource)) {
  throw new Error(
    "PWA service worker calls clients.claim(). This can take over open pages mid-session and revive the refresh loop."
  );
}

const mainSource = await readFile(path.resolve("src/main.tsx"), "utf8");
if (/onNeedRefresh[\s\S]*(updateServiceWorker\?\.\(true\)|updateServiceWorker\(true\))/.test(mainSource)) {
  throw new Error(
    "PWA onNeedRefresh auto-applies service worker updates. Keep updates passive to avoid refresh loops."
  );
}

console.log("No PWA auto-reload or service worker clients.claim() detected.");
