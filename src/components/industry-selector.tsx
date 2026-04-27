"use client";

import { Select } from "./ui/select";
import type { Industry } from "@/lib/types";

interface Props {
  value: Industry | "auto";
  onChange: (v: Industry | "auto") => void;
  className?: string;
}

const OPTIONS: { value: Industry | "auto"; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "restaurant", label: "Restaurant / hospitality" },
  { value: "travel", label: "Travel / tourism" },
  { value: "service", label: "Local service / professional" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "blog", label: "Blog / publication" },
  { value: "general", label: "General / other" },
];

export function IndustrySelector({ value, onChange, className }: Props) {
  return (
    <Select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as Industry | "auto")}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
