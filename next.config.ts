import path from "node:path";
import type { NextConfig } from "next";

function resolveBackendOrigin() {
  const rawValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8888";
  return rawValue.replace(/\/api\/?$/i, "").replace(/\/$/, "");
}

const backendOrigin = resolveBackendOrigin();

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.165"],
  bundlePagesRouterDependencies: true,
  experimental: {
    webpackMemoryOptimizations: true,
    // Compile route entries during startup so the first visit does not block
    // on a large on-demand webpack compilation.
    preloadEntriesOnStart: true,
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
    ];
  },
};

export default nextConfig;
