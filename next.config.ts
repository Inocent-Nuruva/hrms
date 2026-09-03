import path from "node:path";
import type { NextConfig } from "next";

function resolveBackendOrigin() {
  const rawValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8888";
  return rawValue.replace(/\/api\/?$/i, "").replace(/\/$/, "");
}

const backendOrigin = resolveBackendOrigin();

const nextConfig: NextConfig = {
  output: "standalone",
  bundlePagesRouterDependencies: true,
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
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
