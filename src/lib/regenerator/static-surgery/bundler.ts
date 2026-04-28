import type { RegenFile } from "../types";

interface JszipLike {
  file(path: string, content: string | Uint8Array): void;
  generateAsync(opts: {
    type: "uint8array" | "nodebuffer";
    compression?: string;
  }): Promise<Uint8Array>;
}
type JszipCtor = typeof import("jszip");

async function loadJsZip(): Promise<JszipCtor | null> {
  try {
    const moduleName = "jszip";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      default?: JszipCtor;
    } & JszipCtor;
    return (mod.default ?? (mod as unknown as JszipCtor)) as JszipCtor;
  } catch {
    return null;
  }
}

export async function bundleZip(files: RegenFile[]): Promise<{
  bytes: Uint8Array;
  usedFallback: boolean;
  totalUncompressed: number;
}> {
  const Jszip = await loadJsZip();
  let totalUncompressed = 0;
  for (const f of files)
    totalUncompressed +=
      typeof f.content === "string"
        ? Buffer.byteLength(f.content)
        : f.content.byteLength;

  if (Jszip) {
    const zip = new Jszip();
    for (const f of files) zip.file(f.path, f.content);
    const bytes = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    return { bytes, usedFallback: false, totalUncompressed };
  }

  // Fallback: store files in a JSON-manifest tarball-lite structure (not a real zip).
  // Caller can still inspect contents if jszip isn't installed.
  const manifest = {
    note: "jszip not installed — this is a JSON archive. Run `pnpm add jszip` to enable real zip output.",
    files: files.map((f) => ({
      path: f.path,
      encoding: typeof f.content === "string" ? "utf8" : "base64",
      content:
        typeof f.content === "string"
          ? f.content
          : Buffer.from(f.content).toString("base64"),
    })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  return { bytes, usedFallback: true, totalUncompressed };
}
