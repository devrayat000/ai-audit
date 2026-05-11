import type { PublishedSite, RestaurantData } from "@/lib/sites/types";
import { restaurantJsonLd } from "./schema";
import "./styles.css";

interface Props {
  site: PublishedSite;
}

function safeImg(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return undefined;
}

export function RestaurantTemplate({ site }: Props) {
  const d = site.data as RestaurantData;
  const heroImg = safeImg(d.hero.image?.url);
  const sections = d.menu?.sections ?? [];
  const jsonLd = restaurantJsonLd(site);

  return (
    <main className="ai-restaurant">
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          // schema is server-built; trust it
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <header className="ai-restaurant-nav">
        <div className="brand">{d.name}</div>
        <nav className="links" aria-label="Section navigation">
          {d.about && <a href="#about">Story</a>}
          {sections.length > 0 && <a href="#menu">Menu</a>}
          {d.gallery.length > 0 && <a href="#gallery">Gallery</a>}
          <a href="#contact">Visit</a>
        </nav>
      </header>

      <section className="ai-restaurant-hero" aria-label="Hero">
        {heroImg && (
          <img className="hero-bg" src={heroImg} alt="" loading="eager" decoding="async" />
        )}
        {d.cuisine && d.cuisine.length > 0 && (
          <div className="eyebrow">{d.cuisine.join(" · ")}</div>
        )}
        <h1>{d.hero.heading ?? d.name}</h1>
        {d.hero.sub && <p className="sub">{d.hero.sub}</p>}
        {d.hero.cta && (
          <a className="cta" href={d.hero.cta.href} target="_blank" rel="noopener">
            {d.hero.cta.label}
          </a>
        )}
      </section>

      {(d.about || (d.highlights && d.highlights.length > 0)) && (
        <section id="about" aria-labelledby="about-heading">
          <div className="section-eyebrow">Our story</div>
          <h2 id="about-heading">About {d.name}</h2>
          <div className="about">
            <div>
              {site.geo?.summary && (
                <p style={{ fontSize: "1.1rem", marginBottom: "1rem", lineHeight: 1.7 }}>
                  {site.geo.summary}
                </p>
              )}
              {(site.geo?.about ?? d.about) && <p>{site.geo?.about ?? d.about}</p>}
              {d.highlights && d.highlights.length > 0 && (
                <ul className="highlights" aria-label="Highlights">
                  {d.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
            {d.gallery[0] && (
              <img src={d.gallery[0].url} alt={d.gallery[0].alt ?? `${d.name} interior`} loading="lazy" />
            )}
          </div>
        </section>
      )}

      {site.geo?.faqs && site.geo.faqs.length > 0 && (
        <section id="faq" aria-labelledby="faq-heading">
          <div className="section-eyebrow">Good to know</div>
          <h2 id="faq-heading">Frequently asked questions</h2>
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "1.5rem" }}>
            {site.geo.faqs.map((qa, i) => (
              <details
                key={i}
                style={{
                  background: "var(--r-card)",
                  border: "1px solid var(--r-line)",
                  padding: "1rem 1.25rem",
                }}
              >
                <summary
                  style={{ cursor: "pointer", fontWeight: 500, fontSize: "1.05rem" }}
                >
                  {qa.q}
                </summary>
                <p
                  style={{
                    marginTop: "0.75rem",
                    color: "var(--r-muted)",
                    lineHeight: 1.7,
                  }}
                >
                  {qa.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {sections.length > 0 && (
        <section id="menu" aria-labelledby="menu-heading">
          <div className="section-eyebrow">Tasting list</div>
          <h2 id="menu-heading">Menu</h2>
          <div className="menu-grid">
            {sections.map((s, i) => (
              <div className="menu-section" key={i}>
                <h3>{s.title}</h3>
                {s.items.map((item, j) => (
                  <div className="menu-item" key={j}>
                    <div className="name">{item.name}</div>
                    {item.price && <div className="price">{item.price}</div>}
                    {item.description && <div className="desc">{item.description}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.gallery.length > 1 && (
        <section id="gallery" aria-labelledby="gallery-heading">
          <div className="section-eyebrow">Glimpses</div>
          <h2 id="gallery-heading">Gallery</h2>
          <div className="gallery">
            {d.gallery.slice(0, 16).map((img, i) => (
              <img key={i} src={img.url} alt={img.alt ?? `${d.name} photo ${i + 1}`} loading="lazy" />
            ))}
          </div>
        </section>
      )}

      <section id="contact" aria-labelledby="contact-heading">
        <div className="section-eyebrow">Plan your visit</div>
        <h2 id="contact-heading">Find us</h2>
        <div className="contact-grid">
          <div className="contact-block">
            {(d.contact.street || d.contact.city) && (
              <address>
                {d.contact.street && (
                  <>
                    {d.contact.street}
                    <br />
                  </>
                )}
                {[d.contact.city, d.contact.region, d.contact.postalCode]
                  .filter(Boolean)
                  .join(", ")}
                {d.contact.country && (
                  <>
                    <br />
                    {d.contact.country}
                  </>
                )}
                {d.contact.phone && (
                  <>
                    <br />
                    <a href={`tel:${d.contact.phone}`}>{d.contact.phone}</a>
                  </>
                )}
                {d.contact.email && (
                  <>
                    <br />
                    <a href={`mailto:${d.contact.email}`}>{d.contact.email}</a>
                  </>
                )}
              </address>
            )}
            <div className="social">
              {d.social.instagram && (
                <a href={d.social.instagram} target="_blank" rel="noopener">
                  Instagram
                </a>
              )}
              {d.social.facebook && (
                <a href={d.social.facebook} target="_blank" rel="noopener">
                  Facebook
                </a>
              )}
              {d.social.twitter && (
                <a href={d.social.twitter} target="_blank" rel="noopener">
                  X / Twitter
                </a>
              )}
              {d.social.tiktok && (
                <a href={d.social.tiktok} target="_blank" rel="noopener">
                  TikTok
                </a>
              )}
              {d.social.youtube && (
                <a href={d.social.youtube} target="_blank" rel="noopener">
                  YouTube
                </a>
              )}
              {d.social.line && (
                <a href={d.social.line} target="_blank" rel="noopener">
                  LINE
                </a>
              )}
            </div>
            {d.reservationUrl && (
              <p style={{ marginTop: "1.25rem" }}>
                <a
                  className="cta"
                  href={d.reservationUrl}
                  target="_blank"
                  rel="noopener"
                  style={{
                    background: "var(--r-accent)",
                    color: "var(--r-accent-fg)",
                    textDecoration: "none",
                    padding: "0.7rem 1.3rem",
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  Reserve a table
                </a>
              </p>
            )}
          </div>

          {d.hours && d.hours.length > 0 && (
            <div>
              <table className="hours-table" aria-label="Opening hours">
                <tbody>
                  {d.hours.map((h) => (
                    <tr key={h.day}>
                      <th scope="row">{h.day}</th>
                      <td>
                        {h.closed
                          ? "Closed"
                          : h.opens && h.closes
                            ? `${h.opens} – ${h.closes}`
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="ai-restaurant-footer">
        <span>
          © {new Date().getFullYear()} {d.name}
        </span>
        <span className="ai-restaurant-attribution">
          Source:{" "}
          <a href={site.sourceUrl} target="_blank" rel="noopener">
            {new URL(site.sourceUrl).hostname}
          </a>{" "}
          · AI-restored for discoverability
        </span>
      </footer>
    </main>
  );
}
