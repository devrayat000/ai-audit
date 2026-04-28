import type { NextConfig } from "next";

console.log("token", process.env.VERCEL_TOKEN);
console.log("access token", process.env.VERCEL_ACCESS_TOKEN);

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@anthropic-ai/sdk",
    "cheerio",
    "robots-parser",
    "sitemapper",
    "text-readability",
    "jszip",
    "franc-min",
    "rtl-detect",
    "@vercel/client",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
