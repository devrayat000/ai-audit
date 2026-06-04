"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  brand: string;
  tagline?: string;
  links: NavLink[];
  cta?: { label: string; href: string };
}

export function RestaurantNav({ brand, tagline, links, cta }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border"
          : "bg-gradient-to-b from-black/60 to-transparent backdrop-blur-[2px]",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#top" className="flex flex-col leading-none group">
            <span
              className={cn(
                "font-serif text-xl md:text-2xl font-semibold tracking-wide transition-colors duration-300",
                scrolled ? "text-foreground" : "text-white",
              )}
            >
              {brand}
            </span>
            {tagline && (
              <span
                className={cn(
                  "font-sans text-[10px] uppercase tracking-[0.25em] transition-colors duration-300",
                  scrolled ? "text-muted-foreground" : "text-white/70",
                )}
              >
                {tagline}
              </span>
            )}
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "font-sans text-sm tracking-widest uppercase transition-colors duration-200 pb-0.5",
                  "border-b-[1.5px] border-transparent hover:border-current",
                  scrolled ? "text-foreground" : "text-white",
                )}
              >
                {link.label}
              </a>
            ))}
            {cta && (
              <a
                href={cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-sans text-xs tracking-widest uppercase px-5 py-2.5 border transition-all duration-200",
                  scrolled
                    ? "border-gold text-gold hover:bg-gold hover:text-background"
                    : "border-white/60 text-white hover:bg-white/10",
                )}
              >
                {cta.label}
              </a>
            )}
          </nav>

          <button
            className={cn(
              "md:hidden p-2 transition-colors",
              scrolled ? "text-foreground" : "text-white",
            )}
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 bg-background/98 backdrop-blur-md border-b border-border",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col px-6 py-4 gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-sans text-sm tracking-widest uppercase py-3 border-b border-border last:border-0 text-foreground hover:text-gold transition-colors"
            >
              {link.label}
            </a>
          ))}
          {cta && (
            <a
              href={cta.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 text-center font-sans text-xs tracking-widest uppercase px-5 py-3 border border-gold text-gold hover:bg-gold hover:text-background transition-all"
            >
              {cta.label}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
