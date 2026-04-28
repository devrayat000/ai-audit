"use client";

import { Button } from "./ui/button";
import { Download, ExternalLink } from "lucide-react";

interface Props {
  zipBase64: string;
  fileName: string;
  acknowledged: boolean;
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/zip" });
}

export function DeployButtons({ zipBase64, fileName, acknowledged }: Props) {
  const download = () => {
    if (!acknowledged) return;
    const blob = base64ToBlob(zipBase64);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={download} disabled={!acknowledged} size="lg">
        <Download className="size-4" />
        Download .zip
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
