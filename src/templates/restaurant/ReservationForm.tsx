"use client";

import { useState } from "react";
import { Calendar, ChevronDown, Clock, Users } from "lucide-react";

const TIMES = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
];

const GUEST_COUNTS = [
  "1 Guest",
  "2 Guests",
  "3 Guests",
  "4 Guests",
  "5 Guests",
  "6 Guests",
  "7+ (Group)",
];

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Halal-friendly",
  "Gluten-free",
  "Shellfish allergy",
  "Nut allergy",
];

interface Props {
  externalBookingUrl?: string;
}

export function ReservationForm({ externalBookingUrl }: Props) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-card border border-border p-10 text-center flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full border border-gold flex items-center justify-center">
          <span className="text-2xl text-gold font-serif">✓</span>
        </div>
        <h3 className="font-serif text-2xl text-foreground">
          Reservation Requested
        </h3>
        <p className="font-sans text-sm text-muted-foreground max-w-sm leading-relaxed">
          Thank you. The restaurant will confirm by email within 24 hours.
          Please check your inbox — including spam.
        </p>
        {externalBookingUrl && (
          <a
            href={externalBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs tracking-[0.15em] uppercase text-gold border-b border-gold pb-0.5 hover:opacity-70 transition-opacity"
          >
            Book instantly on the restaurant&apos;s system
          </a>
        )}
        <button
          onClick={() => setSubmitted(false)}
          className="font-sans text-xs tracking-[0.15em] uppercase px-6 py-3 border border-border text-foreground hover:bg-secondary transition-colors"
        >
          Make Another Reservation
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border p-8 md:p-10"
    >
      <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-2">
        Step 1 of 1
      </p>
      <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground mb-8">
        Reserve Your Table
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Date <span className="text-gold">*</span>
          </label>
          <div className="relative">
            <Calendar
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="date"
              required
              min={new Date().toISOString().split("T")[0]}
              className="w-full pl-9 pr-4 py-3 bg-background border border-input font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Time <span className="text-gold">*</span>
          </label>
          <div className="relative">
            <Clock
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <select
              required
              defaultValue=""
              className="w-full pl-9 pr-8 py-3 bg-background border border-input font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold appearance-none cursor-pointer"
            >
              <option value="">Select time</option>
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Number of Guests <span className="text-gold">*</span>
          </label>
          <div className="relative">
            <Users
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <select
              required
              defaultValue=""
              className="w-full pl-9 pr-8 py-3 bg-background border border-input font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold appearance-none cursor-pointer"
            >
              <option value="">Select guests</option>
              {GUEST_COUNTS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Phone
          </label>
          <input
            type="tel"
            placeholder="+xx xxx xxx xxxx"
            className="w-full px-4 py-3 bg-background border border-input font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Full Name <span className="text-gold">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Jane Smith"
            className="w-full px-4 py-3 bg-background border border-input font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Email <span className="text-gold">*</span>
          </label>
          <input
            type="email"
            required
            placeholder="your@email.com"
            className="w-full px-4 py-3 bg-background border border-input font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Dietary Restrictions / Allergies
          </label>
          <div className="relative">
            <select
              defaultValue=""
              className="w-full px-4 pr-8 py-3 bg-background border border-input font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold appearance-none cursor-pointer"
            >
              <option value="">None</option>
              {DIETARY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="font-sans text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Special Requests
          </label>
          <textarea
            rows={3}
            placeholder="Celebrations, anniversaries, accessibility needs, high chair..."
            className="w-full px-4 py-3 bg-background border border-input font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold resize-none"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button
          type="submit"
          className="w-full sm:w-auto font-sans text-xs tracking-[0.2em] uppercase px-10 py-4 bg-foreground text-background hover:bg-gold hover:text-ink transition-colors duration-200"
        >
          Request Reservation
        </button>
        <p className="font-sans text-xs text-muted-foreground leading-relaxed">
          Confirmation within 24 hours by email.
          {externalBookingUrl && (
            <>
              {" "}
              <a
                href={externalBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:opacity-70"
              >
                Book instantly →
              </a>
            </>
          )}
        </p>
      </div>
    </form>
  );
}
