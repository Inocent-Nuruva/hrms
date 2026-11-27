import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConfiguration, verifyManifest } from "./ci-release-manifest.mjs";

const valid = () => ({ revision: "abc", configuration: buildConfiguration({ APP_ENV: "uat", NEXT_PUBLIC_API_BASE_URL: "/api" }), runtime: { platform: "linux", arch: "x64", nodeMajor: 22, nodeAbi: "127", glibc: "2.35" } });

test("accepts matching build settings and a compatible runtime", () => {
  const built = valid(); const server = valid(); server.runtime.glibc = "2.39";
  assert.doesNotThrow(() => verifyManifest(built, server));
});
test("rejects mismatched revision, environment, public settings, ABI and older glibc", () => {
  for (const change of [
    (x) => { x.revision = "other"; },
    (x) => { x.configuration.APP_ENV = "production"; },
    (x) => { x.configuration.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8888"; },
    (x) => { x.runtime.nodeAbi = "128"; },
    (x) => { x.runtime.glibc = "2.31"; },
    (x) => { x.runtime.glibc = null; },
  ]) { const server = valid(); change(server); assert.throws(() => verifyManifest(valid(), server)); }
});
