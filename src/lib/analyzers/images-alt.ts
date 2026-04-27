import * as cheerio from "cheerio";
import { makeCheck } from "./base";
import type { PageAnalyzer } from "./base";

const BAD_ALT = /^(image|photo|picture|img_?\d+|dsc_?\d+|untitled|.*\.(jpg|jpeg|png|gif|webp))$/i;

export const imagesAltAnalyzer: PageAnalyzer = {
  key: "images-alt",
  scope: "page",
  run(page) {
    const $ = cheerio.load(page.renderedHtml || page.rawHtml);
    const imgs = $("img").toArray();
    if (imgs.length === 0) {
      return [
        {
          analyzerKey: "images-alt",
          category: "content",
          scope: "page",
          name: "Image Alt Text",
          shortDescription: "Descriptive alt text",
          status: "pass",
          score: 5,
          maxScore: 5,
          message: "No images on the page.",
          evidence: { total: 0 },
          fixSuggestion: "n/a",
          llmFixAvailable: false,
          pageUrl: page.url,
        },
      ];
    }
    let withAlt = 0;
    let weak = 0;
    const examples: Array<{ src: string; alt: string }> = [];
    imgs.forEach((el) => {
      const alt = $(el).attr("alt")?.trim() ?? "";
      const src = $(el).attr("src") ?? "";
      if (alt) {
        withAlt++;
        if (BAD_ALT.test(alt) || alt.length < 4) {
          weak++;
          if (examples.length < 5) examples.push({ src, alt });
        }
      } else if (examples.length < 5) {
        examples.push({ src, alt: "" });
      }
    });
    const total = imgs.length;
    const goodRatio = (withAlt - weak) / total;
    const score = Math.round(goodRatio * 5);
    const status = goodRatio >= 0.85 ? "pass" : goodRatio >= 0.5 ? "warn" : "fail";
    return [
      makeCheck({
        analyzerKey: "images-alt",
        category: "content",
        scope: "page",
        name: "Image Alt Text",
        shortDescription: "Descriptive alt text",
        status,
        score,
        maxScore: 5,
        message: `${withAlt - weak}/${total} images have descriptive alt text (${weak} weak).`,
        evidence: { total, withAlt, weak, examples },
        fixSuggestion:
          status === "pass"
            ? "Alt-text coverage is good."
            : "Replace generic alt text ('image', 'photo', file names) with specific descriptions of subject + context.",
        llmFixAvailable: status !== "pass",
        pageUrl: page.url,
      }),
    ];
  },
};
