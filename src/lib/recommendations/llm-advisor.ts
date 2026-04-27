import type { CheckResult, Industry } from "../types";
import { INDUSTRY_GUIDANCE } from "./industry-rules";

export interface LlmAdvisorInput {
  check: CheckResult;
  industry: Industry;
  pageUrl?: string;
  pageTitle?: string;
  pageDescription?: string;
  pageTextSnippet?: string;
}

export function buildSystemPrompt(industry: Industry): string {
  const g = INDUSTRY_GUIDANCE[industry];
  return [
    "You are an SEO and Generative Engine Optimization (GEO) consultant.",
    "Your job is to write concrete, copy-pasteable fixes for a website so AI engines (Claude, ChatGPT, Perplexity, Google AI Overviews) can read, summarise, and cite the site accurately.",
    "Output should be terse, specific, and entity-rich. No fluff, no marketing clichés.",
    `Industry context: ${industry}.`,
    `Industry must-haves: ${g.mustHaves.join(" | ")}.`,
    `Style hints: ${g.promptHints.join(" ")}`,
  ].join("\n");
}

export function buildUserPrompt(input: LlmAdvisorInput): string {
  const { check, pageUrl, pageTitle, pageDescription, pageTextSnippet } = input;
  const evidence = JSON.stringify(check.evidence ?? {}, null, 2).slice(0, 2000);
  const lines = [
    `Audit finding: ${check.name} (${check.status.toUpperCase()})`,
    `Category: ${check.category}`,
    `Message: ${check.message}`,
    "",
  ];
  if (pageUrl) lines.push(`Page URL: ${pageUrl}`);
  if (pageTitle) lines.push(`Current title: ${pageTitle}`);
  if (pageDescription) lines.push(`Current meta description: ${pageDescription}`);
  if (pageTextSnippet) {
    lines.push("Current page text excerpt:");
    lines.push(pageTextSnippet.slice(0, 1500));
  }
  lines.push("");
  lines.push("Evidence:");
  lines.push("```json");
  lines.push(evidence);
  lines.push("```");
  lines.push("");
  lines.push(
    "Write the fix. Format:",
    "1. One-sentence diagnosis.",
    "2. The recommended replacement (code block, copy block, or snippet — whichever applies).",
    "3. Two or three bullet rationale lines tying it to GEO best practice.",
    "Keep it under 350 words."
  );
  return lines.join("\n");
}

export interface AnthropicLike {
  messages: {
    stream(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): AsyncIterable<{ type: string; delta?: { type: string; text?: string } }>;
  };
}

export async function* streamRecommendation(
  client: AnthropicLike,
  input: LlmAdvisorInput
): AsyncGenerator<string, void, void> {
  const system = buildSystemPrompt(input.industry);
  const user = buildUserPrompt(input);
  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
      yield event.delta.text;
    }
  }
}
