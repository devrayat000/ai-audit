"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ExternalLink, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  originalUrl: string;
  /** base64 JPEG screenshot captured during the regen crawl. Preferred over the iframe — most sites send X-Frame-Options that block embedding. */
  originalScreenshotBase64?: string;
  optimizedHtml: string;
}

const SIZES = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;

type SizeKey = keyof typeof SIZES;

export function SideBySidePreview({ originalUrl, originalScreenshotBase64, optimizedHtml }: Props) {
  const [size, setSize] = useState<SizeKey>("desktop");
  const width = SIZES[size];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Side-by-side preview</CardTitle>
          <div className="flex gap-1">
            <Button variant={size === "mobile" ? "default" : "outline"} size="xs" onClick={() => setSize("mobile")}>
              <Smartphone className="size-3" /> 390
            </Button>
            <Button variant={size === "tablet" ? "default" : "outline"} size="xs" onClick={() => setSize("tablet")}>
              <Tablet className="size-3" /> 768
            </Button>
            <Button variant={size === "desktop" ? "default" : "outline"} size="xs" onClick={() => setSize("desktop")}>
              <Monitor className="size-3" /> 1280
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          <PreviewPane label="Original" subtitle={originalUrl}>
            {originalScreenshotBase64 ? (
              <div className="relative">
                <img
                  src={`data:image/jpeg;base64,${originalScreenshotBase64}`}
                  alt={`Screenshot of ${originalUrl}`}
                  className="w-full h-auto rounded-md border border-border bg-white"
                  style={{ maxWidth: width }}
                />
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-mono shadow-sm hover:bg-background"
                >
                  Open <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <iframe
                src={originalUrl}
                sandbox="allow-same-origin"
                className={cn("w-full h-[60vh] bg-white border border-border rounded-md")}
                style={{ width: "100%", maxWidth: width }}
              />
            )}
          </PreviewPane>
          <PreviewPane label="Optimized" subtitle="In-memory regeneration">
            <iframe
              srcDoc={optimizedHtml}
              sandbox="allow-same-origin allow-scripts"
              className={cn("w-full h-[60vh] bg-white border border-border rounded-md")}
              style={{ width: "100%", maxWidth: width }}
            />
          </PreviewPane>
        </div>
        {!originalScreenshotBase64 && (
          <p className="text-xs text-muted-foreground mt-3">
            Note: most sites send X-Frame-Options or CSP headers that block being embedded in an iframe. If the
            Original pane shows blank, that's the cause — the optimized pane uses srcdoc and bypasses it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewPane({ label, subtitle, children }: { label: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-muted-foreground truncate max-w-[60%]">{subtitle}</span>
      </div>
      <div className="overflow-auto">{children}</div>
    </div>
  );
}
