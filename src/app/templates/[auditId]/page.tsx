"use client";

import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const auditId = params.auditId as string;
  const subdomain = searchParams.get("subdomain") || "site";

  const [selected, setSelected] = useState("shirakawa");

  const handleNext = () => {
    router.push(`/preview/${auditId}?subdomain=${subdomain}&template=${selected}`);
  };

  return (
    <div className="bg-muted/30 min-h-screen text-foreground font-sans">
      <header className="bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-xl">
            <span className="text-danger">●</span> AIVIBLE
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step 2 of 3 — Style Selection
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* PROGRESS STEPPER */}
        <div className="mb-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-accent-brand uppercase tracking-widest">
              Step 2 of 3 — Choose Your Style
            </span>
            <span className="text-xs text-muted-foreground">66%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent-brand transition-[width] duration-300" style={{ width: "66%" }} />
          </div>
        </div>

        <div className="text-center mb-10 space-y-2">
          <h1 className="text-3xl font-serif tracking-tight">Choose your template</h1>
          <p className="text-sm text-muted-foreground">
            All templates are fully AI-optimized. Pick the style that fits your business.
          </p>
        </div>

        {/* 3 TEMPLATE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Shirakawa */}
          <Card
            onClick={() => setSelected("shirakawa")}
            className={`cursor-pointer overflow-hidden transition-all duration-200 border-2 ${
              selected === "shirakawa" ? "border-accent-brand shadow-md" : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-300 relative flex items-end p-4">
              {selected === "shirakawa" && (
                <div className="absolute top-3 right-3 bg-accent-brand text-background text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Selected
                </div>
              )}
              <div className="w-full">
                <div className="h-2 bg-white/60 rounded w-3/4 mb-1.5" />
                <div className="h-1.5 bg-white/40 rounded w-1/2" />
              </div>
            </div>
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Shirakawa</h3>
                <input type="radio" checked={selected === "shirakawa"} readOnly className="accent-accent-brand size-4" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Minimalist / Modern</p>
              <p className="text-xs text-muted-foreground">
                Clean lines, refined typography. Perfect for upscale ryokan and boutique hotels.
              </p>
            </div>
          </Card>

          {/* Nishiki */}
          <Card
            onClick={() => setSelected("nishiki")}
            className={`cursor-pointer overflow-hidden transition-all duration-200 border-2 ${
              selected === "nishiki" ? "border-accent-brand shadow-md" : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-200 relative flex items-end p-4">
              {selected === "nishiki" && (
                <div className="absolute top-3 right-3 bg-accent-brand text-background text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Selected
                </div>
              )}
              <div className="w-full">
                <div className="h-2 bg-white/60 rounded w-3/4 mb-1.5" />
                <div className="h-1.5 bg-white/40 rounded w-1/2" />
              </div>
            </div>
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Nishiki</h3>
                <input type="radio" checked={selected === "nishiki"} readOnly className="accent-accent-brand size-4" />
              </div>
              <p className="text-xs text-warning font-medium">Warm / Traditional</p>
              <p className="text-xs text-muted-foreground">
                Earthy tones, inviting warmth. Ideal for restaurants, food experiences, and cultural spots.
              </p>
            </div>
          </Card>

          {/* Arashiyama */}
          <Card
            onClick={() => setSelected("arashiyama")}
            className={`cursor-pointer overflow-hidden transition-all duration-200 border-2 ${
              selected === "arashiyama" ? "border-accent-brand shadow-md" : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="h-48 bg-gradient-to-br from-emerald-100 to-teal-200 relative flex items-end p-4">
              {selected === "arashiyama" && (
                <div className="absolute top-3 right-3 bg-accent-brand text-background text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Selected
                </div>
              )}
              <div className="w-full">
                <div className="h-2 bg-white/60 rounded w-3/4 mb-1.5" />
                <div className="h-1.5 bg-white/40 rounded w-1/2" />
              </div>
            </div>
            <div className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Arashiyama</h3>
                <input type="radio" checked={selected === "arashiyama"} readOnly className="accent-accent-brand size-4" />
              </div>
              <p className="text-xs text-success font-medium">Nature / Travel</p>
              <p className="text-xs text-muted-foreground">
                Fresh greens, spacious layouts. Great for tours, outdoor experiences, and cultural activities.
              </p>
            </div>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <Button onClick={handleNext} className="px-10 py-6 text-base font-bold bg-accent-brand hover:bg-accent-brand/90 text-white rounded-xl">
            Generate My Website →
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            You can switch templates later without losing your content.
          </p>
        </div>
      </main>
    </div>
  );
}
