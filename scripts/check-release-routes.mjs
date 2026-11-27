import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function verifyRoutes(routes, env) {
  const configured = env.INTERNAL_BACKEND_URL?.trim() || env.BACKEND_ORIGIN?.trim() || env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() || env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallback = env.APP_ENV === "uat" ? "http://127.0.0.1:9999" : "http://localhost:8888";
  const expected = new URL(!configured || configured === "/api" ? fallback : configured).origin;
  for (const [group, source, suffix] of [["beforeFiles", "/uploads/:path*", "/uploads/:path*"], ["afterFiles", "/api/:path*", "/api/:path*"], ["afterFiles", "/socket.io/:path*", "/socket.io/:path*"]]) {
    const route = routes.rewrites?.[group]?.find((item) => item.source === source);
    if (route?.destination !== expected + suffix) throw new Error(`Unexpected ${source} destination for ${env.APP_ENV}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error("Routes manifest path is required.");
  const routes = JSON.parse(await readFile(file, "utf8"));
  verifyRoutes(routes, process.env);
  console.log(`Release routes verified for ${process.env.APP_ENV}.`);
}
