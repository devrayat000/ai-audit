import type { RegenFile } from "../types";

export interface ScaffoldInput {
  projectName: string;
  rootUrl: string;
  industry: string;
  description: string;
}

export function scaffoldNextProject(input: ScaffoldInput): RegenFile[] {
  const out: RegenFile[] = [];
  out.push({
    path: "package.json",
    content: JSON.stringify(
      {
        name: input.projectName,
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "eslint",
        },
        dependencies: {
          next: "16.2.4",
          react: "19.2.4",
          "react-dom": "19.2.4",
        },
        devDependencies: {
          "@types/node": "^20",
          "@types/react": "^19",
          "@types/react-dom": "^19",
          typescript: "^5",
        },
      },
      null,
      2
    ),
  });

  out.push({
    path: "tsconfig.json",
    content: JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2
    ),
  });

  out.push({
    path: "next.config.ts",
    content: `import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n`,
  });

  out.push({
    path: "next-env.d.ts",
    content:
      `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited.\n`,
  });

  out.push({
    path: "src/app/layout.tsx",
    content: `import "./globals.css";

export const metadata = {
  title: "${input.projectName}",
  description: ${JSON.stringify(input.description)},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  });

  out.push({
    path: "src/app/globals.css",
    content: "/* AI-Audit-regenerated styles. Original site CSS is preserved in /public/original-styles. */\n",
  });

  out.push({
    path: "src/app/robots.ts",
    content: `import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "${input.rootUrl.replace(/\/$/, "")}/sitemap.xml",
  };
}
`,
  });

  out.push({
    path: "src/app/sitemap.ts",
    content: `import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "${input.rootUrl}", lastModified: new Date() },
  ];
}
`,
  });

  out.push({
    path: "src/app/llms.txt/route.ts",
    content: `import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return new NextResponse(\`# ${input.projectName}\\n\\n> ${input.description.replace(/`/g, "")}\\n\\n## Pages\\n\\n- [Home](${input.rootUrl})\\n\`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
`,
  });

  out.push({
    path: "README.md",
    content: `# ${input.projectName}

AI-Audit regenerated Next.js scaffold derived from ${input.rootUrl}.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

This is a starting point — components have been extracted from the original HTML; review and refine before publishing.
`,
  });

  return out;
}
