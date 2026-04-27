interface FontPair {
  source: string;
  english: string;
  url?: string;
}

export const SCRIPT_FONT_MAP: Record<string, FontPair[]> = {
  Beng: [
    { source: "Noto Sans Bengali", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;700&display=swap" },
    { source: "Hind Siliguri", english: "Source Sans 3", url: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Hind+Siliguri:wght@400;500;700&display=swap" },
  ],
  Deva: [
    { source: "Noto Sans Devanagari", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;700&display=swap" },
  ],
  Arab: [
    { source: "Tajawal", english: "IBM Plex Sans", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap" },
    { source: "Cairo", english: "IBM Plex Sans", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Cairo:wght@400;500;700&display=swap" },
  ],
  Hebr: [
    { source: "Heebo", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Heebo:wght@400;500;700&display=swap" },
  ],
  Jpan: [
    { source: "Noto Sans JP", english: "Noto Sans", url: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" },
  ],
  Kore: [
    { source: "Noto Sans KR", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" },
  ],
  Hans: [
    { source: "Noto Sans SC", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" },
  ],
  Thai: [
    { source: "Noto Sans Thai", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;700&display=swap" },
  ],
  Cyrl: [
    { source: "Inter Tight", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap" },
  ],
  Latn: [
    { source: "Inter Tight", english: "Inter Tight", url: "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap" },
  ],
};

export function pickFontPair(sourceScript: string, override?: string): FontPair {
  const list = SCRIPT_FONT_MAP[sourceScript] ?? SCRIPT_FONT_MAP.Latn;
  if (override) {
    const found = list.find((f) => f.english.toLowerCase() === override.toLowerCase());
    if (found) return found;
  }
  return list[0];
}

export function buildFontHeadHtml(pair: FontPair, targetIsLatin: boolean): string {
  const out: string[] = [];
  if (pair.url) {
    out.push(`<link rel="preconnect" href="https://fonts.googleapis.com">`);
    out.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`);
    out.push(`<link rel="stylesheet" href="${pair.url}">`);
  }
  const stack = targetIsLatin
    ? `'${pair.english}', '${pair.source}', system-ui, sans-serif`
    : `'${pair.source}', '${pair.english}', system-ui, sans-serif`;
  out.push(
    `<style>:root{--ai-audit-font:${stack};} body, h1, h2, h3, h4, h5, h6, p, a, button, input, textarea, select{font-family: var(--ai-audit-font);}</style>`
  );
  return out.join("\n");
}
