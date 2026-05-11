import {
  buildInitialStatus,
  patchRunStatus,
  writeRunStatus,
} from "@/lib/workflow/status-store";
import { buildPublishedSite, type PublishInput } from "@/lib/sites/publish";
import { writePublishedSite } from "@/lib/sites/storage";
import { applyEnrichment, enrichWithAudit } from "@/lib/sites/ai-enrich";
import type { PublishedSite } from "@/lib/sites/types";
import type { AuditReport } from "@/lib/types";

export interface PublishWorkflowInput extends PublishInput {
  /** Full audit report. Drives the AI enrichment step. */
  audit?: AuditReport;
}

/**
 * Publish workflow: crawl source → scrape into typed site → AI-enrich from
 * audit report → persist to blob. After completion, `<subdomain>.<apex>`
 * serves the templated site, /llms.txt, /llms-full.txt, /sitemap.xml,
 * /robots.txt.
 */
export async function publishSiteWorkflow(
  runId: string,
  input: PublishWorkflowInput,
): Promise<void> {
  "use workflow";

  await initPublishRun(runId, input);
  try {
    const scraped = await scrapeStep(runId, input);
    const enriched = await enrichStep(runId, scraped, input.audit);
    await persistStep(runId, enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markPublishFailed(runId, message);
  }
}

async function initPublishRun(runId: string, input: PublishWorkflowInput): Promise<void> {
  "use step";
  const initial = buildInitialStatus<PublishedSite>(runId, "publish", {
    sourceUrl: input.sourceUrl,
    subdomain: input.subdomain,
    industry: input.industry,
    hasAudit: !!input.audit,
  });
  initial.state = "running";
  initial.message = `Scraping ${input.sourceUrl}…`;
  initial.progress = 5;
  await writeRunStatus(initial);
}

async function scrapeStep(runId: string, input: PublishWorkflowInput): Promise<PublishedSite> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: `Crawling ${input.sourceUrl}…`,
    progress: 25,
  });
  const site = await buildPublishedSite(input);
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: `Extracted ${site.data.industry} data for ${site.data.name}.`,
    progress: 55,
    meta: {
      industry: site.industry,
      gallery: site.data.gallery.length,
      menuSections:
        site.data.industry === "restaurant" ? (site.data.menu?.sections.length ?? 0) : 0,
    },
  });
  return site;
}

async function enrichStep(
  runId: string,
  site: PublishedSite,
  audit?: AuditReport,
): Promise<PublishedSite> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: audit
      ? "Enriching with audit findings (Claude)…"
      : "Generating GEO content (Claude)…",
    progress: 75,
  });
  const enrichment = await enrichWithAudit(site, audit);
  const merged = applyEnrichment(site, enrichment);
  return merged;
}

async function persistStep(runId: string, site: PublishedSite): Promise<void> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: "Publishing to subdomain…",
    progress: 92,
  });
  const url = await writePublishedSite(site);
  const apex = process.env.SITE_PUBLIC_APEX ?? "aivible.tokyo";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "completed",
    progress: 100,
    message: `Published at https://${site.subdomain}.${apex}`,
    result: site,
    meta: { blobUrl: url ?? "" },
  });
}

async function markPublishFailed(runId: string, message: string): Promise<void> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "failed",
    error: message,
    message: `Publish failed: ${message}`,
  });
}
