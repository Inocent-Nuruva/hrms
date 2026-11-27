import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyRoutes } from "./check-release-routes.mjs";

function manifest(origin) {
  return { rewrites: {
    beforeFiles: [{ source: "/uploads/:path*", destination: `${origin}/uploads/:path*` }],
    afterFiles: [{ source: "/api/:path*", destination: `${origin}/api/:path*` }, { source: "/socket.io/:path*", destination: `${origin}/socket.io/:path*` }],
  } };
}
test("accepts environment-specific backend routes and rejects cross-environment routes", () => {
  const uat = { APP_ENV: "uat", NEXT_PUBLIC_API_BASE_URL: "/api" };
  const prod = { APP_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "/api" };
  assert.doesNotThrow(() => verifyRoutes(manifest("http://127.0.0.1:9999"), uat));
  assert.doesNotThrow(() => verifyRoutes(manifest("http://localhost:8888"), prod));
  assert.throws(() => verifyRoutes(manifest("http://localhost:8888"), uat));
  assert.throws(() => verifyRoutes(manifest("http://127.0.0.1:9999"), prod));
});
