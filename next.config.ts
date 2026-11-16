import path from "node:path";
import type { NextConfig } from "next";

export function resolveBackendOrigin() {
  const configuredOrigin =
    process.env.INTERNAL_BACKEND_URL?.trim() ||
    process.env.BACKEND_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim();
  const rawValue = configuredOrigin || process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const fallback = process.env.APP_ENV?.trim().toLowerCase() === "uat"
    ? "http://127.0.0.1:9999" : "http://localhost:8888";
  const url = new URL(!rawValue || rawValue === "/api" ? fallback : rawValue);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !["/", "/api", "/api/"].includes(url.pathname)) {
    throw new Error("The backend rewrite target must be an absolute HTTP(S) origin.");
  }
  return url.origin;
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "192.168.1.165", "192.168.2.22"],
  bundlePagesRouterDependencies: true,
  // Dashboard routes are large. Keep only the active one resident so a long
  // dev session does not pin every visited page in memory.
  onDemandEntries: {
    maxInactiveAge: 20 * 1000,
    pagesBufferLength: 2,
  },
  experimental: {
    webpackMemoryOptimizations: true,
    // Fluent UI's barrel exports hundreds of modules. Only load the controls
    // referenced by each route so development compilation stays within the
    // memory budget.
    optimizePackageImports: [
      "@fluentui/react-components",
      "@fluentui/react-icons",
    ],
    // Avoid compiling every route into one large resident process. Routes are
    // compiled on first visit instead, keeping development memory bounded.
    preloadEntriesOnStart: false,
    // Turbopack's native compiler runs alongside Node. Keep its target below
    // the Node heap cap so a long dev session remains usable on typical PCs.
    turbopackMemoryLimit: 768 * 1024 * 1024,
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
    const backendOrigin = resolveBackendOrigin();
    return {
      // Backend owns uploads; stale frontend public files must not shadow them.
      // Only this app's /uploads paths match. External media URLs stay external.
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: `${backendOrigin}/uploads/:path*`,
        },
      ],
      // Preserve locally implemented App Router API handlers before the API proxy.
      afterFiles: [
        {
          source: "/socket.io",
          destination: `${backendOrigin}/socket.io`,
        },
        {
          source: "/socket.io/:path*",
          destination: `${backendOrigin}/socket.io/:path*`,
        },
        {
          source: "/api/:path*",
          destination: `${backendOrigin}/api/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
