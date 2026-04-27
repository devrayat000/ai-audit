import * as cheerio from "cheerio";

export interface DirectionResult {
  html: string;
  flipped: boolean;
  warnings: string[];
}

const PHYSICAL_RE = /(margin|padding)-(left|right)\s*:\s*([^;}]+)/gi;
const TEXT_ALIGN_RE = /text-align\s*:\s*(left|right)/gi;
const FLOAT_RE = /float\s*:\s*(left|right)/gi;

function rewriteInlineStyle(css: string): { value: string; touched: boolean } {
  let touched = false;
  let out = css;
  out = out.replace(PHYSICAL_RE, (_m, prop, side, val) => {
    touched = true;
    const newProp = `${prop}-inline-${side === "left" ? "start" : "end"}`;
    return `${newProp}: ${val.trim()}`;
  });
  out = out.replace(TEXT_ALIGN_RE, (_m, side) => {
    touched = true;
    return `text-align: ${side === "left" ? "start" : "end"}`;
  });
  out = out.replace(FLOAT_RE, (_m, side) => {
    touched = true;
    return `float: inline-${side === "left" ? "start" : "end"}`;
  });
  return { value: out, touched };
}

export function applyDirection(html: string, fromDir: "ltr" | "rtl", toDir: "ltr" | "rtl"): DirectionResult {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  let flipped = false;

  $("html").attr("dir", toDir);
  if (fromDir === toDir) {
    return { html: $.html(), flipped, warnings };
  }
  flipped = true;

  // rewrite inline styles to logical
  $("[style]").each((_, el) => {
    const $el = $(el);
    const style = $el.attr("style") ?? "";
    const { value, touched } = rewriteInlineStyle(style);
    if (touched) $el.attr("style", value);
  });

  // rewrite <style> blocks
  $("style").each((_, el) => {
    const $el = $(el);
    const css = $el.html() ?? "";
    const { value, touched } = rewriteInlineStyle(css);
    if (touched) $el.html(value);
  });

  // detect direction-specific suspects → warn
  const suspects = $('[style*="transform"], [style*="background-position"], [style*="absolute"]').length;
  if (suspects > 0) {
    warnings.push(`${suspects} element(s) use transform/background-position/absolute positioning — review manually for direction handling.`);
  }

  // mirror obvious directional icon names
  $('svg, i, span').each((_, el) => {
    const cls = ($(el).attr("class") ?? "").toLowerCase();
    if (/(arrow|chevron)-(left|right)/.test(cls)) {
      const swapped = cls.replace(/(arrow|chevron)-left/g, "$1-XLEFT").replace(/(arrow|chevron)-right/g, "$1-left").replace(/(arrow|chevron)-XLEFT/g, "$1-right");
      $(el).attr("class", swapped);
    }
  });

  // safety override
  $("head").append(`<style data-ai-audit-dir="${toDir}">[dir="${toDir}"] body { unicode-bidi: isolate; }</style>`);

  return { html: $.html(), flipped, warnings };
}
