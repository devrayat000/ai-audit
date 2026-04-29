import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

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
    "@vercel/blob",
    "workflow",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(nextConfig);
