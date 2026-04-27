import * as cheerio from "cheerio";

export function fixHeadingHierarchy(html: string): { html: string; changed: boolean; notes: string[] } {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  let changed = false;

  const h1s = $("h1").toArray();
  if (h1s.length > 1) {
    h1s.slice(1).forEach((el) => {
      const $el = $(el);
      const newEl = $("<h2></h2>").html($el.html() ?? "");
      const attrs = (el as { attribs?: Record<string, string> }).attribs ?? {};
      Object.entries(attrs).forEach(([k, v]) => newEl.attr(k, v));
      $el.replaceWith(newEl);
      changed = true;
    });
    notes.push(`Demoted ${h1s.length - 1} extra <h1> to <h2>.`);
  } else if (h1s.length === 0) {
    const firstH2 = $("h2").first();
    if (firstH2.length > 0) {
      const newEl = $("<h1></h1>").html(firstH2.html() ?? "");
      const attrs = (firstH2.get(0) as { attribs?: Record<string, string> }).attribs ?? {};
      Object.entries(attrs).forEach(([k, v]) => newEl.attr(k, v));
      firstH2.replaceWith(newEl);
      changed = true;
      notes.push("Promoted first <h2> to <h1> (no h1 was present).");
    }
  }

  // fix skipped levels: only adjust the *next* heading after a skip
  const all = $("h1, h2, h3, h4, h5, h6").toArray();
  let lastLevel = 0;
  for (const el of all) {
    const tag = (el as { tagName?: string }).tagName ?? "h2";
    const level = Number(tag.slice(1));
    if (lastLevel > 0 && level - lastLevel > 1) {
      const newLevel = lastLevel + 1;
      const $el = $(el);
      const newEl = $(`<h${newLevel}></h${newLevel}>`).html($el.html() ?? "");
      const attrs = (el as { attribs?: Record<string, string> }).attribs ?? {};
      Object.entries(attrs).forEach(([k, v]) => newEl.attr(k, v));
      $el.replaceWith(newEl);
      changed = true;
      lastLevel = newLevel;
    } else {
      lastLevel = level;
    }
  }
  if (changed) notes.push("Normalized heading levels.");
  return { html: $.html(), changed, notes };
}
