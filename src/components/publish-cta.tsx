"use client";

import { Globe2 } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  onClick: () => void;
}

const APEX = process.env.NEXT_PUBLIC_SITE_APEX ?? "shorobik.com";

export function PublishCta({ onClick }: Props) {
  return (
    <div className="rounded-xl bg-card p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ring-1 ring-foreground/10">
      <div className="flex items-start md:items-center gap-3">
        <div className="size-10 rounded-md bg-foreground text-background flex items-center justify-center">
          <Globe2 className="size-5" />
        </div>
        <div>
          <div className="font-heading text-xl md:text-2xl">Publish as an AI-discoverable site</div>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ll scrape the menu, hours, photos and contact info, drop them into a clean
            template, and host it at <span className="font-mono">&lt;name&gt;.{APEX}</span> for AI engines to read.
          </p>
        </div>
      </div>
      <div>
        <Button size="lg" onClick={onClick}>
          Publish to subdomain
        </Button>
      </div>
    </div>
  );
}
