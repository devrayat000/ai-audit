import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: false,
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@anthropic-ai/sdk",
    "cheerio",
    "robots-parser",
    "sitemapper",
    "text-readability",
    "@vercel/blob",
    "workflow",
  ],
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(nextConfig);
