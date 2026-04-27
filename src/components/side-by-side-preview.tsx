"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  originalUrl: string;
  optimizedHtml: string;
}

const SIZES = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;

type SizeKey = keyof typeof SIZES;

export function SideBySidePreview({ originalUrl, optimizedHtml }: Props) {
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
            <iframe
              src={originalUrl}
              sandbox="allow-same-origin"
              className={cn("w-full h-[60vh] bg-white border border-border rounded-md")}
              style={{ width: "100%", maxWidth: width }}
            />
          </PreviewPane>
          <PreviewPane label="Optimized" subtitle="In-memory regeneration">
            <iframe
              srcDoc={optimizedHtml}
              sandbox="allow-same-origin"
              className={cn("w-full h-[60vh] bg-white border border-border rounded-md")}
              style={{ width: "100%", maxWidth: width }}
            />
          </PreviewPane>
        </div>
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
