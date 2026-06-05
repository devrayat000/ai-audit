"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  categories: { id: string; label: string }[];
}

export function MenuCategoryNav({ categories }: Props) {
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const [stuck, setStuck] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "-1px 0px 0px 0px", threshold: [1] },
    );
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [categories]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      ref={navRef}
      className={cn(
        "sticky top-16 md:top-20 z-40 bg-background transition-shadow duration-200",
        stuck ? "shadow-sm border-b border-border" : "border-b border-border",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center gap-1 overflow-x-auto py-3 -mx-1 px-1">
          {categories.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={cn(
                "shrink-0 font-sans text-xs tracking-[0.15em] uppercase px-4 py-2 transition-all duration-200 whitespace-nowrap",
                active === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
