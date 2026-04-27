"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Select } from "./ui/select";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Loader2 } from "lucide-react";
import type { DetectedLanguage, GlossaryEntry, TranslationConfig, TranslationMode } from "@/lib/regenerator/types";
import type { Industry } from "@/lib/types";

const COMMON_LANGS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bangla" },
  { code: "ur", label: "Urdu" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
];

interface Props {
  rootUrl: string;
  industry: Industry;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  config: TranslationConfig | null;
  onConfigChange: (c: TranslationConfig | null) => void;
}

export function LanguagePicker({ rootUrl, industry, enabled, onEnabledChange, config, onConfigChange }: Props) {
  const [detected, setDetected] = useState<DetectedLanguage | null>(null);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await fetch("/api/regenerate/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: rootUrl }),
        });
        const j = await r.json();
        if (aborted) return;
        if (!r.ok) throw new Error(j.error ?? "Detection failed");
        setDetected(j.detected as DetectedLanguage);
        setGlossary(j.glossary as GlossaryEntry[]);
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : "Detection failed");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [rootUrl]);

  useEffect(() => {
    if (!enabled || !detected) {
      onConfigChange(null);
      return;
    }
    if (!config) {
      const target = detected.language === "en" ? "es" : "en";
      onConfigChange({
        mode: "transcreate",
        sourceLanguage: detected.language,
        sourceScript: detected.script,
        sourceDirection: detected.direction,
        targetLanguage: target,
        targetDirection: target === "ar" || target === "he" || target === "fa" || target === "ur" ? "rtl" : "ltr",
        glossary,
        industry,
      });
    }
  }, [enabled, detected, config, glossary, industry, onConfigChange]);

  const setMode = (mode: TranslationMode) => {
    if (!config) return;
    onConfigChange({ ...config, mode });
  };
  const setTarget = (code: string) => {
    if (!config) return;
    const dir: "ltr" | "rtl" = ["ar", "he", "fa", "ur"].includes(code) ? "rtl" : "ltr";
    onConfigChange({ ...config, targetLanguage: code, targetDirection: dir });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language &amp; localization</CardTitle>
        <p className="text-sm text-muted-foreground">
          {loading ? "Detecting source language…" :
            detected ? <>Detected source: <Badge variant="outline" className="ml-1">{detected.language} · {detected.script} · {detected.direction.toUpperCase()}</Badge>{" "}{detected.needsConfirmation && <span className="text-[color:var(--warning)]">(low confidence — confirm before translating)</span>}</> :
            "Could not detect language."}
        </p>
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={enabled} onCheckedChange={onEnabledChange} />
          <span className="text-sm">Translate to a different language</span>
        </label>

        {enabled && config && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Target language</label>
              <Select value={config.targetLanguage} onChange={(e) => setTarget(e.target.value)} className="mt-1">
                {COMMON_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Mode</label>
              <Select value={config.mode} onChange={(e) => setMode(e.target.value as TranslationMode)} className="mt-1">
                <option value="literal">Literal — exact translation</option>
                <option value="transcreate">Transcreate — idiomatic rewrite</option>
                <option value="bilingual">Bilingual — keep original AND add /{config.targetLanguage}/ subtree (recommended for SEO + AI)</option>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
