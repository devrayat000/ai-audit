"use client";

import { Rocket } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  onClick: () => void;
}

export function RegenerateCta({ onClick }: Props) {
  return (
    <div className="rounded-xl border border-foreground bg-foreground text-background p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-start md:items-center gap-3">
        <div className="size-10 rounded-md bg-background/10 flex items-center justify-center">
          <Rocket className="size-5" />
        </div>
        <div>
          <div className="font-serif text-xl md:text-2xl">Want this fixed automatically?</div>
          <p className="text-sm opacity-80">
            Regenerate an AI-optimized version of your site with all these fixes applied — keeping your design intact.
          </p>
        </div>
      </div>
      <div>
        <Button variant="secondary" size="lg" onClick={onClick}>
          Regenerate optimized version
        </Button>
      </div>
    </div>
  );
}
