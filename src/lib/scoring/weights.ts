import type { Category } from "../types";

/**
 * Weights tuned for GEO (Generative Engine Optimization). Access signals
 * — robots.txt openness, llms.txt, sitemap — matter most because they
 * gate AI-bot discovery entirely. Meta/structure follow because that is
 * what engines actually parse. eeat is retained in the type for legacy
 * but no analyzer feeds it; the score engine skips categories with no
 * checks.
 */
export const CATEGORY_WEIGHTS: Record<Category, number> = {
  access: 0.3,
  meta: 0.25,
  structure: 0.2,
  content: 0.1,
  performance: 0.1,
  security: 0.05,
  eeat: 0,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  access: "AI Access",
  meta: "Meta & Schema",
  structure: "Structure",
  content: "Content",
  performance: "Crawlability",
  security: "Security",
  eeat: "E-E-A-T",
};
