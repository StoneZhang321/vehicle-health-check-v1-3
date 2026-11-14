/** 中文：为实际构建产物生成离线清单，不执行部署。 English: Generate an offline manifest for actual output, without deploying. */
import { build } from "vite";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
await build();
const files = [];
/** 中文：收集静态资源以确保首次准备后完整离线。 English: Collect assets for complete offline use after initial preparation. */
async function walk(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) await walk(join(dir, entry.name), path + "/");
    else if (!["sw.js", "_headers", "_redirects"].includes(path)) files.push("/" + path);
  }
}
await walk("dist");
const identity = createHash("sha256");
for (const file of files.sort()) identity.update(await readFile("dist" + file));
const cache = "vhcinspect-1.3-" + identity.digest("hex").slice(0, 12);
const worker = await readFile("scripts/service-worker.js", "utf8");
await writeFile("dist/sw.js", worker.replace("__CACHE_NAME__", JSON.stringify(cache)).replace("__PRECACHE__", JSON.stringify(["/", ...files])));
console.log("Offline resources: " + files.length + "; " + cache);
