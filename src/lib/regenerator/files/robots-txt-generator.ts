export function buildRobotsTxt(rootUrl: string): string {
  const sitemap = `${rootUrl.replace(/\/$/, "")}/sitemap.xml`;
  const bots = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Applebot-Extended",
    "Amazonbot",
    "Meta-ExternalAgent",
    "Bytespider",
  ];
  const lines: string[] = [];
  lines.push("User-agent: *");
  lines.push("Allow: /");
  lines.push("");
  for (const b of bots) {
    lines.push(`User-agent: ${b}`);
    lines.push("Allow: /");
    lines.push("");
  }
  lines.push(`Sitemap: ${sitemap}`);
  lines.push("");
  return lines.join("\n");
}
