import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const buildKeys = ["APP_ENV", "COUNTRIES_API_BASE_URL", "INTERNAL_BACKEND_URL", "BACKEND_ORIGIN"];

export function buildConfiguration(env) {
  const keys = new Set([...buildKeys, ...Object.keys(env).filter((key) => key.startsWith("NEXT_PUBLIC_"))]);
  return Object.fromEntries([...keys].sort().map((key) => [key, createHash("sha256").update(env[key] || "").digest("hex")]));
}

export function runtimeInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeMajor: Number(process.versions.node.split(".")[0]),
    nodeAbi: process.versions.modules,
    glibc: process.report.getReport().header.glibcVersionRuntime ?? null,
  };
}

function versionAtLeast(actual, required) {
  if (!/^\d+\.\d+$/.test(actual ?? "") || !/^\d+\.\d+$/.test(required ?? "")) return false;
  const [a, b] = actual.split(".").map(Number);
  const [x, y] = required.split(".").map(Number);
  return a > x || (a === x && b >= y);
}

export function verifyManifest(manifest, current) {
  if (manifest.revision !== current.revision) throw new Error("Release revision does not match the deployment commit.");
  for (const key of new Set([...Object.keys(manifest.configuration), ...Object.keys(current.configuration)])) {
    if ((manifest.configuration[key] ?? "") !== (current.configuration[key] ?? "")) throw new Error(`Build configuration differs for ${key}.`);
  }
  for (const key of ["platform", "arch", "nodeMajor", "nodeAbi"]) {
    if (manifest.runtime[key] !== current.runtime[key]) throw new Error(`Build runtime differs for ${key}.`);
  }
  if (manifest.runtime.platform !== "linux" || !versionAtLeast(current.runtime.glibc, manifest.runtime.glibc)) throw new Error("Deployment glibc is missing or older than the build runtime.");
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if (!file || !process.env.GITHUB_SHA) throw new Error("Manifest path and GITHUB_SHA are required.");
  const current = { revision: process.env.GITHUB_SHA, configuration: buildConfiguration(process.env), runtime: runtimeInfo() };
  if (mode === "create") await writeFile(file, JSON.stringify(current, null, 2) + "\n");
  else if (mode === "verify") verifyManifest(JSON.parse(await readFile(file, "utf8")), current);
  else throw new Error("Expected create or verify.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
