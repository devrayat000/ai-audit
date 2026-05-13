import * as cheerio from "cheerio";
import type { DetectedSourceLanguage } from "./types";

const RTL_LANGS = new Set([
  "ar", "he", "fa", "ur", "ps", "yi", "dv", "ckb", "ku", "sd",
]);

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

const ENGLISH_STOPWORDS = [
  " the ", " and ", " is ", " of ", " to ", " a ", " in ", " for ", " on ", " with ",
  " we ", " our ", " you ", " your ", " from ", " about ", " menu ", " home ",
  " contact ", " open ", " hours ", " today ", " more ",
];

function looksEnglish(text: string): boolean {
  if (text.length < 60) return false;
  const lower = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  let hits = 0;
  for (const stop of ENGLISH_STOPWORDS) {
    if (lower.includes(stop)) hits++;
    if (hits >= 4) return true;
  }
  return false;
}

/**
 * Lightweight, dependency-free source-language detection. Picks signals from:
 *   1. <html lang>
 *   2. Unicode-script bucket of the visible text
 *   3. English-stopword density (catches Latin-script non-English too)
 */
export function detectSourceLanguage(homepageHtml: string): DetectedSourceLanguage {
  const $ = cheerio.load(homepageHtml);
  const htmlLang = ($("html").attr("lang") ?? "")
    .trim()
    .toLowerCase()
    .split("-")[0];
  const dirAttr = ($("html").attr("dir") ?? "").trim().toLowerCase();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const script = detectScript(text);
  const langFromScript = fallbackLanguageFromScript(script);
  const englishVibe = script === "Latn" && looksEnglish(text);

  const language =
    htmlLang ||
    (englishVibe ? "en" : langFromScript);

  let direction: "ltr" | "rtl" = "ltr";
  if (dirAttr === "rtl") direction = "rtl";
  else if (RTL_LANGS.has(language)) direction = "rtl";

  const isEnglish = language === "en" || (script === "Latn" && englishVibe);

  return { language: language || "und", script, direction, isEnglish };
}
