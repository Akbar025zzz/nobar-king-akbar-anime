import type { NextConfig } from "next";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // Same-origin API + realtime for the browser: /api and /socket.io are proxied
  // to the backend. In the docker/gateway setup nginx handles this; in local
  // `next dev` these rewrites keep everything on one origin.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${INTERNAL_API_URL}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${INTERNAL_API_URL}/socket.io/:path*` },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
