import type { NextConfig } from "next";

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
  ],
};

export default nextConfig;
