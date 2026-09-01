import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native .node binding that bundlers can't
  // process as an ESM asset — keep it as a real require() at runtime
  // instead of trying to bundle it.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
