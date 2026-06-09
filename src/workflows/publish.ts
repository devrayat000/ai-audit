import { getWritable, createHook } from "workflow";
import {
  buildInitialStatus,
  patchRunStatus,
  writeRunStatus,
} from "@/lib/workflow/status-store";
import { buildPublishedSite, type PublishInput } from "@/lib/sites/publish";
import { writePublishedSite } from "@/lib/sites/storage";
import { applyEnrichment, enrichWithAudit, generateQuestionsForMissingFields } from "@/lib/sites/ai-enrich";
import { translateSiteToEnglish } from "@/lib/sites/translator";
import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import type { AuditReport } from "@/lib/types";

export interface PublishWorkflowInput extends PublishInput {
  /** Full audit report. Drives the AI enrichment step. */
  audit?: AuditReport;
}

interface PublishEvent {
  state: "running" | "completed" | "failed";
  message: string;
  progress?: number;
  result?: PublishedSite;
  plannedUrl?: string;
  error?: string;
  meta?: Record<string, unknown>;
}

/**
 * Publish workflow: crawl source → scrape into typed site → AI-enrich from
 * audit report → persist to blob. Streams progress as SSE chunks via
 * `workflow.getWritable()`. After completion, `<subdomain>.<apex>` serves the
 * templated site plus /llms.txt, /llms-full.txt, /robots.txt, /sitemap.xml.
 */
export async function publishSiteWorkflow(
  runId: string,
  input: PublishWorkflowInput,
): Promise<PublishedSite> {
  "use workflow";

  await initPublishRun(runId, input);
  try {
    const scraped = await scrapeStep(runId, input);
    const customized = await userCustomizationStep(runId, scraped);
    const translated = await translateStep(runId, customized);
    const enriched = await enrichStep(runId, translated, input.audit);
    return await persistStep(runId, enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markPublishFailed(runId, message);
    throw err;
  }
}

async function initPublishRun(
  runId: string,
  input: PublishWorkflowInput,
): Promise<void> {
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

  await emit({
    state: "running",
    message: initial.message,
    progress: initial.progress,
    meta: initial.meta,
  });
}

async function scrapeStep(
  runId: string,
  input: PublishWorkflowInput,
): Promise<PublishedSite> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: `Crawling ${input.sourceUrl}…`,
    progress: 25,
  });
  await emit({
    state: "running",
    message: `Crawling ${input.sourceUrl}…`,
    progress: 25,
  });

  const site = await buildPublishedSite(input);

  const meta = {
    industry: site.industry,
    gallery: site.data.gallery.length,
    menuSections:
      site.data.industry === "restaurant"
        ? (site.data.menu?.sections.length ?? 0)
        : 0,
  };
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: `Extracted ${site.data.industry} data for ${site.data.name}.`,
    progress: 55,
    meta,
  });
  await emit({
    state: "running",
    message: `Extracted ${site.data.industry} data for ${site.data.name}.`,
    progress: 55,
    meta,
  });
  return site;
}

async function userCustomizationStep(
  runId: string,
  site: PublishedSite,
): Promise<PublishedSite> {
  "use step";

  const questions = await generateQuestionsForMissingFields(site);
  if (questions.length === 0) {
    return site;
  }

  // Save the questions to state so the frontend knows we are waiting for input
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "waiting_for_input",
    message: "Waiting for user customization inputs...",
    progress: 58,
    meta: { questions },
  });

  await emit({
    state: "waiting_for_input",
    message: "Waiting for user customization inputs...",
    progress: 58,
    meta: { questions },
  });

  // Suspend workflow run using a dynamic hook
  const hook = createHook<Record<string, string>>({ token: `customize:${runId}` });
  const answers = await hook;

  // Set running state again
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: "Customization answers received. Merging...",
    progress: 60,
  });

  await emit({
    state: "running",
    message: "Customization answers received. Merging...",
    progress: 60,
  });

  // Merge the answers back into the scraped site object
  const merged = { ...site };
  const d = { ...merged.data };

  if (answers.street) {
    d.contact = { ...d.contact, street: answers.street };
  }
  if (answers.city) {
    d.contact = { ...d.contact, city: answers.city };
  }
  if (answers.phone) {
    d.contact = { ...d.contact, phone: answers.phone };
  }
  if (answers.description) {
    d.description = answers.description;
  }
  if (answers.highlights) {
    d.highlights = answers.highlights.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (d.industry === "restaurant") {
    const r = d as RestaurantData;
    if (answers.cuisine) {
      r.cuisine = answers.cuisine.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (answers.hours) {
      r.description = `${r.description || ""}\nOpening Hours: ${answers.hours}`.trim();
    }
  }

  merged.data = d;
  return merged;
}

async function translateStep(
  runId: string,
  site: PublishedSite,
): Promise<PublishedSite> {
  "use step";
  if (site.source?.isEnglish) {
    const skipMsg = "Source already in English — skipping translation.";
    await patchRunStatus<PublishedSite>("publish", runId, {
      state: "running",
      message: skipMsg,
      progress: 62,
    });
    await emit({ state: "running", message: skipMsg, progress: 62 });
    return { ...site, translated: true };
  }
  const startMsg = `Translating ${site.source?.language ?? "source"} → English…`;
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: startMsg,
    progress: 62,
  });
  await emit({ state: "running", message: startMsg, progress: 62 });

  const { site: out, notes } = await translateSiteToEnglish(site);
  const doneMsg = out.translated
    ? "Translated to English."
    : notes[0] ?? "Translation step finished.";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: doneMsg,
    progress: 70,
    meta: { translateNotes: notes },
  });
  await emit({
    state: "running",
    message: doneMsg,
    progress: 70,
    meta: { translateNotes: notes },
  });
  return out;
}

async function enrichStep(
  runId: string,
  site: PublishedSite,
  audit?: AuditReport,
): Promise<PublishedSite> {
  "use step";
  const msg = audit
    ? "Enriching with audit findings (Claude)…"
    : "Generating GEO content (Claude)…";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: msg,
    progress: 75,
  });
  await emit({ state: "running", message: msg, progress: 75 });

  const enrichment = await enrichWithAudit(site, audit);
  const merged = applyEnrichment(site, enrichment);

  const enrichMeta = {
    summaryChars: enrichment.summary?.length ?? 0,
    aboutChars: enrichment.about?.length ?? 0,
    faqCount: enrichment.faqs?.length ?? 0,
    notes: enrichment.notes,
  };
  const doneMsg = enrichment.faqs?.length
    ? `Generated ${enrichment.faqs.length} FAQs + GEO copy.`
    : "GEO enrichment finished.";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: doneMsg,
    progress: 85,
    meta: enrichMeta,
  });
  await emit({
    state: "running",
    message: doneMsg,
    progress: 85,
    meta: enrichMeta,
  });
  return merged;
}

async function persistStep(
  runId: string,
  site: PublishedSite,
): Promise<PublishedSite> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "running",
    message: "Publishing to subdomain…",
    progress: 92,
  });
  await emit({
    state: "running",
    message: "Publishing to subdomain…",
    progress: 92,
  });

  const url = await writePublishedSite(site);
  const apex = process.env.SITE_PUBLIC_APEX ?? "shorobik.com";
  const plannedUrl = `https://${site.subdomain}.${apex}`;

  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "completed",
    progress: 100,
    message: `Published at ${plannedUrl}`,
    result: site,
    meta: { blobUrl: url ?? "" },
  });

  await emit({
    state: "completed",
    message: `Published at ${plannedUrl}`,
    progress: 100,
    result: site,
    plannedUrl,
  });

  // Close the stream so the client reader unblocks immediately rather than
  // waiting for the workflow's auto-close.
  await closeStream();
  return site;
}

async function markPublishFailed(runId: string, message: string): Promise<void> {
  "use step";
  await patchRunStatus<PublishedSite>("publish", runId, {
    state: "failed",
    error: message,
    message: `Publish failed: ${message}`,
  });
  await emit({
    state: "failed",
    message: `Publish failed: ${message}`,
    error: message,
  });
  await closeStream();
}

async function emit(payload: PublishEvent): Promise<void> {
  const writable = getWritable<string>();
  const writer = writable.getWriter();
  try {
    await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  } finally {
    try {
      writer.releaseLock();
    } catch {
      /* already released */
    }
  }
}

async function closeStream(): Promise<void> {
  try {
    await getWritable<string>().close();
  } catch {
    // Stream may already be closed by the workflow runtime — safe to ignore.
  }
}
