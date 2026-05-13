import crypto from "node:crypto";
import type { ClassifiedNode } from "./classifier";
import type { TextClassification, TranslationConfig } from "../types";
import { languageName } from "./detector";

export interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export interface TranslationCache {
  get(hash: string): string | undefined;
  set(hash: string, value: string): void;
}

export class InMemoryTranslationCache implements TranslationCache {
  private map = new Map<string, string>();
  get(hash: string) {
    return this.map.get(hash);
  }
  set(hash: string, value: string) {
    this.map.set(hash, value);
  }
}

export function hashText(s: string, mode: TextClassification): string {
  return crypto
    .createHash("sha256")
    .update(`${mode}|${s}`)
    .digest("hex")
    .slice(0, 32);
}

interface TranslateBatchInput {
  client: AnthropicLike | null;
  cfg: TranslationConfig;
  cache: TranslationCache;
  nodes: ClassifiedNode[];
}

const MAX_PER_BATCH = 30;

const SYSTEM_BASE = (cfg: TranslationConfig) =>
  `You translate from ${languageName(cfg.sourceLanguage)} to ${languageName(cfg.targetLanguage)}.
Industry: ${cfg.industry}.
NEVER invent facts not in the source. Preserve numbers, prices, dates, addresses, emails, URLs, and any [[KEEP:...]] tokens verbatim.
If unsure, preserve the source phrasing and ambiguity.
Output ONLY a JSON array of objects: [{"id": string, "translation": string}]. No prose, no markdown.`;

const SYSTEM_LITERAL = (cfg: TranslationConfig) =>
  `${SYSTEM_BASE(cfg)}
Mode: LITERAL — translate word-for-word preserving sentence structure. Do not smooth or summarize.`;

const SYSTEM_TRANSCREATE = (cfg: TranslationConfig) =>
  `${SYSTEM_BASE(cfg)}
Mode: TRANSCREATE — rewrite each string to read naturally to a native ${languageName(cfg.targetLanguage)} speaker. Preserve meaning, tone, and every factual claim. Stay terse.`;

const SYSTEM_FLAG_LEGAL = (cfg: TranslationConfig) =>
  `${SYSTEM_BASE(cfg)}
Mode: FLAG-LEGAL — translate literally. Preserve numbers, named entities, units. Do NOT smooth or summarize. Output will be flagged for human review.`;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function applyKeepTokens(
  text: string,
  glossarySources: string[],
): { protected: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let i = 0;
  let out = text;
  for (const term of glossarySources) {
    if (!term) continue;
    if (out.toLowerCase().includes(term.toLowerCase())) {
      const re = new RegExp(escapeRegex(term), "g");
      out = out.replace(re, (m) => {
        const id = `[[KEEP:${i++}]]`;
        tokens.set(id, m);
        return id;
      });
    }
  }
  return { protected: out, tokens };
}

function restoreKeepTokens(text: string, tokens: Map<string, string>): string {
  let out = text;
  tokens.forEach((v, k) => {
    out = out.split(k).join(v);
  });
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preservationCheck(
  source: string,
  target: string,
): { ok: boolean; reason?: string } {
  const numbersSrc = (source.match(/\b\d[\d,.]*\b/g) ?? []).filter(
    (n) => n.length >= 2,
  );
  for (const n of numbersSrc) {
    if (!target.includes(n)) return { ok: false, reason: `Lost number "${n}"` };
  }
  const emails = source.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g) ?? [];
  for (const e of emails) {
    if (!target.includes(e)) return { ok: false, reason: `Lost email "${e}"` };
  }
  const urls = source.match(/\bhttps?:\/\/\S+\b/g) ?? [];
  for (const u of urls) {
    if (!target.includes(u)) return { ok: false, reason: `Lost URL "${u}"` };
  }
  return { ok: true };
}

function fallbackPassthrough(source: string, cfg: TranslationConfig): string {
  // No client / failure: preserve source so we never invent facts.
  if (cfg.targetLanguage === cfg.sourceLanguage) return source;
  return source;
}

export interface TranslationResult {
  perNodeId: Map<
    string,
    {
      translation: string;
      classification: TextClassification;
      preservationOk: boolean;
      preservationReason?: string;
    }
  >;
  errors: string[];
}

export async function translateClassified(
  input: TranslateBatchInput,
): Promise<TranslationResult> {
  const { client, cfg, cache, nodes } = input;
  const errors: string[] = [];
  const out = new Map<
    string,
    {
      translation: string;
      classification: TextClassification;
      preservationOk: boolean;
      preservationReason?: string;
    }
  >();
  const glossarySources = cfg.glossary
    .filter((g) => g.handling !== "translate")
    .map((g) => g.source);

  // group by classification
  const groups: Record<TextClassification, ClassifiedNode[]> = {
    preserve: [],
    "preserve-pn": [],
    literal: [],
    transcreate: [],
    "flag-legal": [],
  };
  for (const n of nodes) groups[n.classification].push(n);

  // preserve groups: just copy source
  for (const n of [...groups.preserve, ...groups["preserve-pn"]]) {
    let translation = n.text;
    if (n.classification === "preserve-pn") {
      const entry = cfg.glossary.find(
        (g) => g.source.toLowerCase() === n.text.toLowerCase(),
      );
      if (entry) {
        if (entry.handling === "translate") {
          // fall through to literal pipeline below by re-classifying
          groups.literal.push({ ...n, classification: "literal" });
          continue;
        }
        translation = entry.target || entry.source;
      }
    }
    out.set(n.id, {
      translation,
      classification: n.classification,
      preservationOk: true,
    });
  }

  for (const cls of ["literal", "transcreate", "flag-legal"] as const) {
    const group = groups[cls];
    if (group.length === 0) continue;

    // cache + dedupe
    const uncached: ClassifiedNode[] = [];
    const protectedMap = new Map<string, ReturnType<typeof applyKeepTokens>>();
    for (const n of group) {
      const protectedRes = applyKeepTokens(n.text, glossarySources);
      protectedMap.set(n.id, protectedRes);
      const h = hashText(protectedRes.protected, cls);
      const cached = cache.get(h);
      if (cached !== undefined) {
        const restored = restoreKeepTokens(cached, protectedRes.tokens);
        const check = preservationCheck(n.text, restored);
        out.set(n.id, {
          translation: restored,
          classification: cls,
          preservationOk: check.ok,
          preservationReason: check.reason,
        });
      } else {
        uncached.push(n);
      }
    }

    if (uncached.length === 0) continue;

    if (!client) {
      for (const n of uncached) {
        out.set(n.id, {
          translation: fallbackPassthrough(n.text, cfg),
          classification: cls,
          preservationOk: true,
          preservationReason: "No LLM client; source preserved.",
        });
      }
      errors.push(
        "Anthropic client unavailable: kept source text for translatable strings.",
      );
      continue;
    }

    const system =
      cls === "literal"
        ? SYSTEM_LITERAL(cfg)
        : cls === "transcreate"
          ? SYSTEM_TRANSCREATE(cfg)
          : SYSTEM_FLAG_LEGAL(cfg);

    for (const batch of chunk(uncached, MAX_PER_BATCH)) {
      const payload = batch.map((n) => ({
        id: n.id,
        text: protectedMap.get(n.id)!.protected,
        context: n.contextHint,
      }));
      const userMsg = `Translate each entry. Output JSON array. Entries:\n${JSON.stringify(payload, null, 2)}`;
      try {
        const res = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 2048,
          system,
          messages: [{ role: "user", content: userMsg }],
        });
        const txt = res.content.map((c) => c.text ?? "").join("");
        const json = extractJsonArray(txt);
        const parsed = JSON.parse(json) as {
          id: string;
          translation: string;
        }[];
        for (const item of parsed) {
          const n = batch.find((x) => x.id === item.id);
          if (!n) continue;
          const restored = restoreKeepTokens(
            item.translation,
            protectedMap.get(n.id)!.tokens,
          );
          const check = preservationCheck(n.text, restored);
          const final = check.ok ? restored : n.text; // fail-closed
          out.set(n.id, {
            translation: final,
            classification: cls,
            preservationOk: check.ok,
            preservationReason: check.reason,
          });
          cache.set(
            hashText(protectedMap.get(n.id)!.protected, cls),
            check.ok ? item.translation : n.text,
          );
        }
        // any missing
        for (const n of batch) {
          if (!out.has(n.id)) {
            out.set(n.id, {
              translation: n.text,
              classification: cls,
              preservationOk: false,
              preservationReason: "Missing in LLM response",
            });
          }
        }
      } catch (e) {
        errors.push(
          `Batch failed (${cls}): ${e instanceof Error ? e.message : String(e)}`,
        );
        for (const n of batch) {
          out.set(n.id, {
            translation: n.text,
            classification: cls,
            preservationOk: false,
            preservationReason: "LLM error",
          });
        }
      }
    }
  }

  return { perNodeId: out, errors };
}

function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) return "[]";
  return text.slice(start, end + 1);
}
