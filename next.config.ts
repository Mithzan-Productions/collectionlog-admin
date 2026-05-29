import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
