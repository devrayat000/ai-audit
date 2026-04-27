import type { Category } from "../types";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  access: 0.25,
  structure: 0.2,
  content: 0.15,
  meta: 0.15,
  security: 0.1,
  performance: 0.1,
  eeat: 0.05,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  access: "Access",
  structure: "Structure",
  content: "Content",
  meta: "Meta & Schema",
  security: "Security",
  performance: "Performance",
  eeat: "E-E-A-T",
};
