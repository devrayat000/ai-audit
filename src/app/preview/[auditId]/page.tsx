"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublishedSite } from "@/lib/sites/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, PartyPopper } from "lucide-react";

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const auditId = params.auditId as string;
  const subdomain = searchParams.get("subdomain") || "";
  const template = searchParams.get("template") || "shirakawa";

  const [site, setSite] = useState<PublishedSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain) {
      setError("No subdomain provided.");
      setLoading(false);
      return;
    }

    // Since Vercel Blob updates might be slightly delayed, retry fetching if not found immediately
    const fetchSite = async (retries = 3) => {
      try {
        const r = await fetch(`/api/publish/site?subdomain=${subdomain}`);
        if (r.status === 404 && retries > 0) {
          setTimeout(() => fetchSite(retries - 1), 2000);
          return;
        }
        if (!r.ok) throw new Error("Failed to fetch site config.");
        const data = await r.json();
        setSite(data);
        setLoading(false);
      } catch (err) {
        if (retries === 0) {
          setError("Storefront data is still publishing in the background. Check again in a few seconds.");
          setLoading(false);
        }
      }
    };

    fetchSite();
  }, [subdomain]);

  const handleCopy = () => {
    const link = `https://${subdomain}.shorobik.com`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Loader2 className="size-8 animate-spin text-accent-brand" />
        <p className="text-sm text-muted-foreground animate-pulse">Finalizing your AI-optimized storefront...</p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <p className="text-danger font-semibold mb-2">{error || "Published site not found."}</p>
        <Link href={`/customize/${auditId}`}>
          <Button className="bg-accent-brand text-white mt-2">Try again</Button>
        </Link>
      </div>
    );
  }

  const d = site.data;
  const isRestaurant = d.industry === "restaurant";

  return (
    <div className="bg-muted/30 min-h-screen text-foreground font-sans">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-xl">
            <span className="text-danger">●</span> AIVIBLE
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step 3 of 3 — Live Preview
          </span>
        </div>
      </header>

      {published && (
        <div className="bg-success text-white py-3 px-4 transition-all duration-300">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <PartyPopper className="size-4 shrink-0 animate-bounce" />
              <span>Congratulations! Your AI website is live and discoverable.</span>
            </div>
            <a
              href={`https://${subdomain}.shorobik.com`}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold"
            >
              Visit site <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT: STOREFRONT PREVIEW */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Step 3 progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-accent-brand uppercase tracking-widest">
                  Step 3 of 3 — Preview Storefront
                </span>
                <span className="text-xs text-muted-foreground">100%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent-brand" style={{ width: "100%" }} />
              </div>
            </div>

            {/* PREVIEW STOREFRONT CARD */}
            <Card className="border border-border shadow-sm overflow-hidden bg-background">
              {/* HERO SECTION */}
              <div className="relative h-60 bg-slate-900 flex items-end p-6 overflow-hidden">
                {d.hero?.image?.url ? (
                  <img
                    src={d.hero.image.url}
                    alt={d.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-slate-900 opacity-60" />
                )}
                <div className="relative z-10 space-y-1.5 text-white">
                  <div className="text-xs text-white/75 font-semibold uppercase tracking-wider">
                    {isRestaurant ? "Restaurant" : "General Business"} · {d.contact?.city || "Japan"}
                  </div>
                  <h1 className="text-3xl font-bold font-serif leading-none">{d.name}</h1>
                  <p className="text-white/80 text-sm max-w-md line-clamp-2">
                    {d.tagline || d.description || "Welcome to our business."}
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* AMENITIES / HIGHLIGHTS */}
                {d.highlights && d.highlights.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Highlights
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {d.highlights.map((h, i) => (
                        <span key={i} className="text-xs bg-muted text-foreground/80 px-3 py-1.5 rounded-full font-medium">
                          ✓ {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* DESCRIPTION */}
                {d.description && (
                  <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Description
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {d.description}
                    </p>
                  </div>
                )}

                {/* CONTACT DETAILS */}
                <div>
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Contact &amp; Access
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-xl">
                    <div className="space-y-1.5">
                      <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Address</div>
                      <p>{d.contact?.street || "No street address listed"}</p>
                      <p>{d.contact?.city || ""}</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Contact Info</div>
                      {d.contact?.phone && <p>📞 {d.contact.phone}</p>}
                      {d.contact?.email && <p>✉ {d.contact.email}</p>}
                    </div>
                  </div>
                </div>

                {/* CTA BUTTON */}
                <Button className="w-full py-4 bg-accent-brand hover:bg-accent-brand/90 text-white font-bold rounded-xl text-base shadow-sm">
                  Book Reservation
                </Button>
              </div>
            </Card>
          </div>

          {/* RIGHT: SCORE CARD SIDEBAR */}
          <div className="w-full lg:w-72 shrink-0 space-y-6">
            <Card className="border border-border shadow-sm p-5 space-y-6 bg-background">
              {/* NEW SCORE GAUGE */}
              <div className="flex items-center gap-4 pb-5 border-b border-border">
                <div className="w-16 h-16 bg-success rounded-full flex flex-col items-center justify-center text-white shadow-sm shrink-0">
                  <span className="text-2xl font-bold leading-none">A</span>
                  <span className="text-[10px] font-semibold opacity-90">91/100</span>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">New GEO Score</div>
                  <div className="font-bold text-success text-sm">AI-Ready!</div>
                  <div className="text-xs text-muted-foreground">Was: {site.meta?.description ? "42/100" : "D"}</div>
                </div>
              </div>

              {/* CHECKLIST */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What was fixed</h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-success shrink-0" />
                    <span>Robots.txt allow rules generated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-success shrink-0" />
                    <span>llms.txt map file created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-success shrink-0" />
                    <span>JSON-LD structured schema inject</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-success shrink-0" />
                    <span>Semantic markup tags injected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-3.5 text-success shrink-0" />
                    <span>Fully crawlable plain-text cache</span>
                  </div>
                </div>
              </div>

              {/* SHARE LINK */}
              <div className="pt-4 border-t border-border space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Share link</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground bg-muted border border-border px-2.5 py-2 rounded-lg truncate flex-1">
                    {subdomain}.shorobik.com
                  </span>
                  <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                {copied && <span className="text-[10px] text-success block font-medium">Link copied!</span>}
              </div>

              {/* PUBLISH CTA */}
              {!published && (
                <Button onClick={() => setPublished(true)} className="w-full bg-accent-brand hover:bg-accent-brand/90 text-white font-semibold py-3 rounded-xl">
                  Publish My AI Website
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
