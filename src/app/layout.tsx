import type { Metadata } from "next";
import { Geist_Mono, Inter_Tight, Fraunces } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AI Audit — See your site through an AI's eyes",
  description:
    "Audit any website for AI / LLM compatibility (GEO). Per-page and site-wide reports with actionable, industry-specific fixes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", sans.variable, serif.variable, mono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
