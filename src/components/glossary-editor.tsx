"use client";

import type { GlossaryEntry } from "@/lib/regenerator/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  glossary: GlossaryEntry[];
  onChange: (g: GlossaryEntry[]) => void;
  rootUrl: string;
  enabled: boolean;
}

export function GlossaryEditor({ glossary, onChange, rootUrl, enabled }: Props) {
  const [autoFetched, setAutoFetched] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (autoFetched) return;
    if (glossary.length > 0) {
      setAutoFetched(true);
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/regenerate/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: rootUrl }),
        });
        const j = await r.json();
        if (Array.isArray(j.glossary)) onChange(j.glossary);
      } catch {}
      setAutoFetched(true);
    })();
  }, [enabled, autoFetched, glossary, onChange, rootUrl]);

  if (!enabled) return null;

  const update = (i: number, patch: Partial<GlossaryEntry>) => {
    const next = [...glossary];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(glossary.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...glossary, { source: "", handling: "preserve", target: "", origin: "user" }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Glossary — proper nouns &amp; locked terms</CardTitle>
        <p className="text-sm text-muted-foreground">
          Auto-extracted from your site. <strong>Preserve</strong> = keep verbatim. <strong>Transliterate</strong> = keep with Latin spelling. <strong>Translate</strong> = let the AI translate.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {glossary.length === 0 && <p className="text-sm text-muted-foreground">No terms detected yet.</p>}
        <div className="space-y-1">
          {glossary.slice(0, 30).map((g, i) => (
            <div key={i} className="grid grid-cols-[1fr_160px_1fr_40px] gap-2 items-center">
              <Input
                value={g.source}
                onChange={(e) => update(i, { source: e.target.value })}
                placeholder="source term"
              />
              <Select
                value={g.handling}
                onValueChange={(v) => v && update(i, { handling: v as GlossaryEntry["handling"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preserve">Preserve</SelectItem>
                  <SelectItem value="transliterate">Transliterate</SelectItem>
                  <SelectItem value="translate">Translate</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={g.target}
                onChange={(e) => update(i, { target: e.target.value })}
                placeholder="target (optional)"
              />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>+ Add term</Button>
        </div>
      </CardContent>
    </Card>
  );
}
