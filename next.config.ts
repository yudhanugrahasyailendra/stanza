import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mysql2"],
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  // Preview hosts that load the dev server cross-origin (carried over from the old Vite allowedHosts).
  allowedDevOrigins: ["*.manuspre.computer", "*.manus.computer", "*.manus-asia.computer", "*.manuscomputer.ai", "*.manusvm.computer"],
};

export default nextConfig;
