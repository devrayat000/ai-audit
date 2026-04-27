import type { ClassifiedNode } from "./classifier";
import type { TranslationWarning } from "../types";

export interface ExpansionInput {
  pageUrl: string;
  nodes: ClassifiedNode[];
  translations: Map<string, { translation: string }>;
  ratioThreshold?: number;
  longThreshold?: number;
}

/**
 * Heuristic overflow detector — runs without Playwright re-rendering by
 * comparing source vs translated character lengths. Flags any string
 * whose translated version is significantly longer (typical risk for
 * narrow CSS containers like buttons, nav items, hero headings).
 */
export function detectExpansionRisks(input: ExpansionInput): TranslationWarning[] {
  const out: TranslationWarning[] = [];
  const ratio = input.ratioThreshold ?? 1.45;
  const longThresh = input.longThreshold ?? 30;
  for (const n of input.nodes) {
    const t = input.translations.get(n.id);
    if (!t) continue;
    const s = n.text.length;
    const e = t.translation.length;
    if (s === 0) continue;
    const r = e / s;
    if (e >= longThresh && r >= ratio) {
      const tag = n.selectorPath.split(" > ").pop() ?? "";
      const isTight = /(button|h1|h2|h3|nav|li|a)\b/.test(tag) || /badge|chip|btn|card-title|hero|tagline/.test(tag);
      if (isTight) {
        out.push({
          pageUrl: input.pageUrl,
          selector: n.selectorPath,
          kind: "overflow",
          message: `Text grew ${(r * 100 - 100).toFixed(0)}% (${s}→${e} chars) — may overflow on narrow viewports.`,
        });
      }
    }
  }
  return out;
}

export function flagPreservationFailures(
  pageUrl: string,
  nodes: ClassifiedNode[],
  translations: Map<string, { translation: string; preservationOk: boolean; preservationReason?: string }>
): TranslationWarning[] {
  const out: TranslationWarning[] = [];
  for (const n of nodes) {
    const t = translations.get(n.id);
    if (!t) continue;
    if (!t.preservationOk) {
      out.push({
        pageUrl,
        selector: n.selectorPath,
        kind: "preservation-fail",
        message: t.preservationReason ?? "Preservation check failed; source kept verbatim.",
      });
    }
  }
  return out;
}

export function flagLegalNodes(pageUrl: string, nodes: ClassifiedNode[]): TranslationWarning[] {
  return nodes
    .filter((n) => n.classification === "flag-legal")
    .map((n) => ({
      pageUrl,
      selector: n.selectorPath,
      kind: "legal-flag" as const,
      message: `String matched legal/medical/allergy heuristics. Mandatory human review: "${n.text.slice(0, 80)}".`,
    }));
}
