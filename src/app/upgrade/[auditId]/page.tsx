import { notFound } from "next/navigation";
import { readAuditReport } from "@/lib/audit/storage";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ auditId: string }>;
}

export default async function UpgradePage(props: Props) {
  const params = await props.params;
  const report = await readAuditReport(params.auditId);

  if (!report) {
    notFound();
  }

  const apex = process.env.NEXT_PUBLIC_SITE_APEX ?? "shorobik.com";

  return (
    <div className="bg-muted/30 min-h-screen text-foreground font-sans">
      <header className="bg-background border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/results/${report.id}`} className="flex items-center gap-1.5 font-bold text-xl">
            <span className="text-danger">●</span> AIVIBLE
          </Link>
          <Link href={`/results/${report.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4 mr-1" />
              Back to results
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex items-center gap-2 bg-success/10 text-success text-xs font-semibold px-4 py-1.5 rounded-full border border-success/20">
            🎉 Free during beta — no credit card, no commitment
          </div>
          <h1 className="text-3xl md:text-5xl font-serif tracking-tight leading-none">
            See the difference AI-optimization makes
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            We will create a dedicated, AI-optimized page for{" "}
            <span className="font-mono font-medium text-foreground">{report.domain}</span> —
            one that ChatGPT, Gemini, and Perplexity can actually read and recommend.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground pt-2">
            <span>✓ Your existing website is not changed</span>
            <span>✓ Ready in 60 seconds</span>
          </div>
        </div>

        {/* COMPARISON CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* BEFORE */}
          <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
            <div className="bg-muted/50 px-4 py-3 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 bg-danger rounded-full" />
                <div className="w-3 h-3 bg-warning rounded-full" />
                <div className="w-3 h-3 bg-success rounded-full" />
              </div>
              <span className="text-xs text-muted-foreground font-mono">{report.domain}</span>
            </div>
            <div className="bg-foreground text-background p-4 font-mono text-[11px] leading-relaxed h-52 overflow-y-auto">
              <div className="text-success">$ AI reading {report.domain}...</div>
              <div className="text-muted-foreground">&lt;title&gt;{report.domain}&lt;/title&gt;</div>
              <div className="text-warning">⚠ robots.txt AI bots blocked/restricted</div>
              <div className="text-warning">⚠ Schema.org structured data check failed</div>
              <div className="text-warning">⚠ Dynamic JS detected (empty fallback)</div>
              <div className="text-danger mt-2">❌ Result: cannot read main content. Score: {report.overallScore}/100</div>
              <div className="text-danger mt-1 text-xs opacity-75">Result: cannot recommend this business</div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-danger uppercase tracking-wider mb-3">
                  What&apos;s missing
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <X className="size-4 text-danger shrink-0" />
                    <span>AI bots cannot crawl or parse the text</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="size-4 text-danger shrink-0" />
                    <span>Missing structured JSON-LD entity definition</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="size-4 text-danger shrink-0" />
                    <span>No English localization translated for global travelers</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* AFTER */}
          <div className="bg-background rounded-2xl border-2 border-accent-brand overflow-hidden shadow-md flex flex-col">
            <div className="bg-accent-brand text-background px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 bg-background/40 rounded-full" />
                <div className="w-3 h-3 bg-background/40 rounded-full" />
                <div className="w-3 h-3 bg-background/40 rounded-full" />
              </div>
              <span className="text-xs text-background/80 font-mono">optimized-storefront.{apex}</span>
              <span className="ml-auto text-[10px] bg-background text-accent-brand px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                AI-Ready
              </span>
            </div>
            <div className="h-52 bg-accent-brand/5 flex items-center justify-center border-b border-border">
              <div className="text-center p-4">
                <div className="text-4xl mb-2">✨</div>
                <div className="text-sm font-semibold text-accent-brand">AI-Optimized Storefront</div>
                <p className="text-xs text-muted-foreground mt-1">
                  100% plain text, semantic tags, correct layout schemas, & sitemaps auto-built.
                </p>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-success uppercase tracking-wider mb-3">
                  What you get
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success shrink-0" />
                    <span>Fully indexed and readable by all LLM bots</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success shrink-0" />
                    <span>Structured Business & Menu schema included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success shrink-0" />
                    <span>English ready for foreign travelers & global AI</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE TABLE */}
        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden mb-12">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-lg">Feature comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                  <th className="px-6 py-3">Feature</th>
                  <th className="px-6 py-3 text-center">Now</th>
                  <th className="px-6 py-3 text-center text-accent-brand">With AIVIBLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-6 py-4 font-medium">Found by ChatGPT & Search Bots</td>
                  <td className="px-6 py-4 text-center text-danger font-bold">✗</td>
                  <td className="px-6 py-4 text-center text-success font-bold">✓</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Readable Plain-Text layout (no JS required)</td>
                  <td className="px-6 py-4 text-center text-danger font-bold">✗</td>
                  <td className="px-6 py-4 text-center text-success font-bold">✓</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Industry Schema Markup (Opening Hours, Location, Menu)</td>
                  <td className="px-6 py-4 text-center text-danger font-bold">✗</td>
                  <td className="px-6 py-4 text-center text-success font-bold">✓</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Self-Configured llms.txt & robots.txt</td>
                  <td className="px-6 py-4 text-center text-danger font-bold">✗</td>
                  <td className="px-6 py-4 text-center text-success font-bold">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-4 space-y-3">
          <Link href={`/signup?auditId=${report.id}`}>
            <Button size="lg" className="px-10 py-6 text-base font-bold bg-accent-brand hover:bg-accent-brand/90 text-white rounded-xl">
              Get My AI Website — Free
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Ready in 60 seconds. Your existing website is not modified.
          </p>
        </div>
      </main>
    </div>
  );
}
