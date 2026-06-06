import { Star } from "lucide-react";
import type { GuestReview, RatingSummary } from "@/lib/sites/types";

interface Props {
  summary?: string;
  ratingSummary?: RatingSummary;
  reviews?: GuestReview[];
}

export function ReviewsSection({ summary, ratingSummary, reviews }: Props) {
  const hasReviews = reviews && reviews.length > 0;
  const hasRating = !!ratingSummary;
  if (!summary && !hasReviews && !hasRating) return null;

  return (
    <section className="py-14 md:py-20 bg-secondary/40 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="text-center mb-10">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold mb-3">
            Guest Voices
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-5 text-balance">
            What Our Guests Say
          </h2>

          {hasRating && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <div className="flex items-center gap-1.5">
                {renderStars(Math.round(ratingSummary!.score))}
              </div>
              <span className="font-serif text-3xl text-foreground">
                {ratingSummary!.score.toFixed(1)}
              </span>
              <span className="font-sans text-sm text-muted-foreground">
                Based on {formatCount(ratingSummary!.count)} reviews
                {ratingSummary!.platforms?.length
                  ? ` · ${ratingSummary!.platforms.join(", ")}`
                  : ""}
              </span>
            </div>
          )}

          {summary && (
            <div className="mt-6 max-w-2xl mx-auto bg-card border border-border p-5 text-left hover:shadow-lg hover:border-gold/30 transition-all duration-300">
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold mb-2">
                AI Review Summary
              </p>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                {summary}
              </p>
            </div>
          )}
        </div>

        {hasReviews && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews!.slice(0, 6).map((r, i) => (
              <article
                key={`${r.name}-${i}`}
                className="bg-card border border-border p-6 flex flex-col gap-4 hover:shadow-lg hover:border-gold/30 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex gap-1">{renderStars(r.rating, 13)}</div>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed flex-1">
                  &ldquo;{r.text}&rdquo;
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {r.flag && (
                      <span
                        className="text-lg shrink-0"
                        aria-label={r.country ?? ""}
                      >
                        {r.flag}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-foreground truncate">
                        {r.name}
                      </p>
                      <p className="font-sans text-xs text-muted-foreground truncate">
                        {[r.country, r.date].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  {r.platform && (
                    <span className="shrink-0 font-sans text-[10px] uppercase tracking-wider text-muted-foreground border border-border px-2 py-1">
                      {r.sourceUrl ? (
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-gold transition-colors"
                        >
                          {r.platform}
                        </a>
                      ) : (
                        r.platform
                      )}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function renderStars(filled: number, size = 16) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const isFilled = i <= filled;
    out.push(
      <Star
        key={i}
        size={size}
        className={
          isFilled
            ? "fill-gold text-gold"
            : "text-muted-foreground/40"
        }
      />,
    );
  }
  return out;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return String(n);
}
