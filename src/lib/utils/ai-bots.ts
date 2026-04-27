export interface AiBot {
  name: string;
  userAgent: string;
  vendor: string;
}

export const AI_BOTS: AiBot[] = [
  {
    name: "GPTBot",
    userAgent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
    vendor: "OpenAI",
  },
  {
    name: "OAI-SearchBot",
    userAgent: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
    vendor: "OpenAI",
  },
  {
    name: "ChatGPT-User",
    userAgent: "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    vendor: "OpenAI",
  },
  {
    name: "ClaudeBot",
    userAgent: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    vendor: "Anthropic",
  },
  {
    name: "Claude-Web",
    userAgent: "Mozilla/5.0 (compatible; Claude-Web/1.0; +https://www.anthropic.com/)",
    vendor: "Anthropic",
  },
  {
    name: "PerplexityBot",
    userAgent: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://www.perplexity.ai/perplexitybot)",
    vendor: "Perplexity",
  },
  {
    name: "Google-Extended",
    userAgent: "Mozilla/5.0 (compatible; Google-Extended/1.0)",
    vendor: "Google",
  },
  {
    name: "CCBot",
    userAgent: "CCBot/2.0 (https://commoncrawl.org/faq/)",
    vendor: "CommonCrawl",
  },
  {
    name: "Bytespider",
    userAgent: "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    vendor: "ByteDance",
  },
  {
    name: "Applebot-Extended",
    userAgent: "Mozilla/5.0 (compatible; Applebot-Extended/0.1; +http://www.apple.com/go/applebot)",
    vendor: "Apple",
  },
  {
    name: "Amazonbot",
    userAgent: "Mozilla/5.0 (Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)",
    vendor: "Amazon",
  },
  {
    name: "Meta-ExternalAgent",
    userAgent: "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    vendor: "Meta",
  },
];

export const DEFAULT_HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
