"use client";

import { Button } from "./ui/button";
import { Download, ExternalLink } from "lucide-react";
import type { RegenZipRef } from "@/lib/regenerator/types";

interface Props {
  zip: RegenZipRef;
  fileName: string;
  acknowledged: boolean;
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/zip" });
}

export function DeployButtons({ zip, fileName, acknowledged }: Props) {
  const download = () => {
    if (!acknowledged) return;
    if (zip.url) {
      // Blob URL is public — let the browser download direct from CDN.
      const a = document.createElement("a");
      a.href = zip.url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
      return;
    }
    if (zip.base64) {
      const blob = base64ToBlob(zip.base64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={download} disabled={!acknowledged} size="lg">
        <Download className="size-4" />
        Download .zip
        <span className="ml-2 text-xs opacity-70">
          {(zip.sizeBytes / 1024).toFixed(0)} KB
        </span>
      </Button>
      <Button
        variant="outline"
        size="lg"
        disabled={!acknowledged}
        onClick={() => window.open("https://app.netlify.com/drop", "_blank", "noopener")}
      >
        <ExternalLink className="size-4" />
        Open Netlify Drop
      </Button>
    </div>
  );
}
