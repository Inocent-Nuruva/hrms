import path from "node:path";
import type { NextConfig } from "next";

function resolveBackendOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN?.trim() ||
    process.env.BACKEND_ORIGIN?.trim();
  const rawValue =
    configuredOrigin ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:8888";

  if (rawValue === "" || rawValue === "/api") {
    return "http://localhost:8888";
  }

  return rawValue.replace(/\/api\/?$/i, "").replace(/\/$/, "");
}

const backendOrigin = resolveBackendOrigin();

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.165"],
  bundlePagesRouterDependencies: true,
  // Dashboard routes are large. Keep only the active one resident so a long
  // dev session does not pin every visited page in memory.
  onDemandEntries: {
    maxInactiveAge: 20 * 1000,
    pagesBufferLength: 2,
  },
  experimental: {
    webpackMemoryOptimizations: true,
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
    if (!backendOrigin) {
      return [];
    }

    return [
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
    ];
  },
};

export default nextConfig;
