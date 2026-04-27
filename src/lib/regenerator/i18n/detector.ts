import * as cheerio from "cheerio";
import type { DetectedLanguage } from "../types";

interface FrancLike { (s: string): string }

const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "yi", "dv", "ckb", "ku", "sd"]);

/**
 * Detect script via Unicode block analysis.
 * Returns ISO 15924 script code.
 */
function detectScript(text: string): string {
  const sample = text.slice(0, 4000);
  if (/[ঀ-৿]/.test(sample)) return "Beng";
  if (/[ऀ-ॿ]/.test(sample)) return "Deva";
  if (/[؀-ۿݐ-ݿ]/.test(sample)) return "Arab";
  if (/[֐-׿]/.test(sample)) return "Hebr";
  if (/[฀-๿]/.test(sample)) return "Thai";
  if (/[぀-ゟ゠-ヿ]/.test(sample)) return "Jpan";
  if (/[가-힯]/.test(sample)) return "Kore";
  if (/[一-鿿]/.test(sample)) return "Hans";
  if (/[Ѐ-ӿ]/.test(sample)) return "Cyrl";
  if (/[Ͱ-Ͽ]/.test(sample)) return "Grek";
  return "Latn";
}

function fallbackLanguageFromScript(script: string): string {
  switch (script) {
    case "Beng": return "bn";
    case "Deva": return "hi";
    case "Arab": return "ar";
    case "Hebr": return "he";
    case "Thai": return "th";
    case "Jpan": return "ja";
    case "Kore": return "ko";
    case "Hans": return "zh";
    case "Cyrl": return "ru";
    case "Grek": return "el";
    default: return "en";
  }
}

async function loadFranc(): Promise<FrancLike | null> {
  try {
    const moduleName = "franc-min";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as { franc?: FrancLike } & Record<string, unknown>;
    return (mod.franc as FrancLike) ?? (mod.default as FrancLike) ?? null;
  } catch {
    return null;
  }
}

async function loadRtlDetect(): Promise<((lang: string) => boolean) | null> {
  try {
    const moduleName = "rtl-detect";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      isRtlLang?: (l: string) => boolean;
      default?: { isRtlLang: (l: string) => boolean };
    };
    return mod.isRtlLang ?? mod.default?.isRtlLang ?? null;
  } catch {
    return null;
  }
}

export async function detectLanguageFromHtml(html: string): Promise<DetectedLanguage> {
  const $ = cheerio.load(html);
  const htmlLang = ($("html").attr("lang") ?? "").trim().toLowerCase().split("-")[0];
  const dirAttr = ($("html").attr("dir") ?? "").trim().toLowerCase();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const script = detectScript(text);

  const franc = await loadFranc();
  let francLang: string | null = null;
  if (franc && text.length >= 60) {
    try {
      const code3 = franc(text.slice(0, 4000));
      if (code3 && code3 !== "und") francLang = iso6393To1(code3);
    } catch {}
  }

  const language = htmlLang || francLang || fallbackLanguageFromScript(script);
  const isRtlFn = await loadRtlDetect();
  let direction: "ltr" | "rtl" = "ltr";
  if (dirAttr === "rtl") direction = "rtl";
  else if (isRtlFn) direction = isRtlFn(language) ? "rtl" : "ltr";
  else if (RTL_LANGS.has(language)) direction = "rtl";

  let confidence = 0;
  if (htmlLang) confidence += 0.5;
  if (francLang && francLang === language) confidence += 0.3;
  if (script !== "Latn" && fallbackLanguageFromScript(script) === language) confidence += 0.2;
  if (htmlLang && francLang && htmlLang !== francLang) confidence -= 0.2;
  confidence = Math.max(0, Math.min(1, confidence));
  const needsConfirmation = confidence < 0.6 || (!!htmlLang && !!francLang && htmlLang !== francLang);

  return { language, script, direction, confidence, needsConfirmation };
}

function iso6393To1(code3: string): string | null {
  const map: Record<string, string> = {
    eng: "en", spa: "es", fra: "fr", deu: "de", ita: "it", por: "pt", nld: "nl", swe: "sv",
    nor: "no", dan: "da", fin: "fi", pol: "pl", rus: "ru", ukr: "uk", ces: "cs", slk: "sk",
    hun: "hu", ron: "ro", ell: "el", tur: "tr", ara: "ar", heb: "he", fas: "fa", urd: "ur",
    hin: "hi", ben: "bn", tam: "ta", tel: "te", kan: "kn", mar: "mr", guj: "gu", pan: "pa",
    tha: "th", vie: "vi", ind: "id", msa: "ms", jpn: "ja", kor: "ko", zho: "zh", cmn: "zh",
  };
  return map[code3] ?? null;
}

export function languageName(code: string): string {
  const NAMES: Record<string, string> = {
    en: "English", bn: "Bangla", hi: "Hindi", ar: "Arabic", he: "Hebrew", fa: "Persian",
    ur: "Urdu", ja: "Japanese", ko: "Korean", zh: "Chinese", th: "Thai", ru: "Russian",
    es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese",
    nl: "Dutch", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish", pl: "Polish",
    tr: "Turkish", el: "Greek", uk: "Ukrainian", cs: "Czech", hu: "Hungarian", ro: "Romanian",
    ta: "Tamil", te: "Telugu", kn: "Kannada", mr: "Marathi", gu: "Gujarati", pa: "Punjabi",
    vi: "Vietnamese", id: "Indonesian",
  };
  return NAMES[code] ?? code.toUpperCase();
}
