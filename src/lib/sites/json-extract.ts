/**
 * String-aware, brace-balanced JSON extraction + light repair. Used by both
 * the translator and ai-enrich, where Claude sometimes emits text around the
 * JSON or makes the classic trailing-comma mistake.
 */

export function extractJsonObject(text: string): string {
  const stripped = text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/\s*```/g, "");
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start >= 0) return stripped.slice(start, i + 1);
    }
  }
  return "{}";
}

export function repairJson(raw: string): string {
  // Strip trailing commas before `}` or `]` — most common Claude mistake.
  // String-aware so commas inside string values are preserved.
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j++;
      if (raw[j] === "}" || raw[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

export function parseJsonLenient(text: string): unknown {
  const json = extractJsonObject(text);
  try {
    return JSON.parse(json);
  } catch (e) {
    const repaired = repairJson(json);
    try {
      return JSON.parse(repaired);
    } catch {
      throw e;
    }
  }
}
