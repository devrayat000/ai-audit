"use client";

import { useState } from "react";
import type { AuditReport } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScoreRadial } from "./score-radial";
import { CategoryBars } from "./category-bars";
import { CheckResultRow } from "./check-result-row";
import { PageList } from "./page-list";
import { ExternalLink, Globe2 } from "lucide-react";
import { PublishCta } from "./publish-cta";
import { PublishWizard } from "./publish-wizard";

const INDUSTRY_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  travel: "Travel",
  service: "Service",
  ecommerce: "Ecommerce",
  blog: "Blog",
  general: "General",
};

export function AuditReportView({ report }: { report: AuditReport }) {
  const [publishOpen, setPublishOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Globe2 className="size-3.5" />
              <span className="font-mono">{report.domain}</span>
              <a
                href={report.rootUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
            <h2 className="font-serif text-3xl md:text-4xl tracking-tight">
              AI compatibility report
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="text-[10px] uppercase">
                {INDUSTRY_LABEL[report.industry] ?? report.industry}
              </Badge>
              <span>·</span>
              <span>{report.pagesAnalyzed} pages</span>
              <span>·</span>
              <span>
                {report.siteChecks.length +
                  report.pages.reduce((a, p) => a + p.checks.length, 0)}{" "}
                checks
              </span>
              <span>·</span>
              <span className="font-mono text-xs">
                {new Date(report.completedAt).toLocaleString()}
              </span>
            </div>
          </div>
          <ScoreRadial
            score={report.overallScore}
            grade={report.grade}
            size={180}
          />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Site-level checks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {report.siteChecks.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">
                No site-level checks ran.
              </div>
            ) : (
              report.siteChecks.map((c) => (
                <CheckResultRow key={c.analyzerKey} check={c} report={report} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBars scores={report.categoryScores} />
          </CardContent>
        </Card>
      </div>

      <PublishCta onClick={() => setPublishOpen(true)} />

      <Card>
        <CardHeader>
          <CardTitle>Top recommendations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.topRecommendations.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              Nothing major to fix. Nice.
            </div>
          ) : (
            report.topRecommendations.map((c) => (
              <CheckResultRow key={c.analyzerKey} check={c} report={report} />
            ))
          )}
        </CardContent>
      </Card>

      <PageList report={report} />

      {report.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Crawl notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              {report.errors.slice(0, 20).map((e, i) => (
                <li key={i}>· {e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PublishWizard
        report={report}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
