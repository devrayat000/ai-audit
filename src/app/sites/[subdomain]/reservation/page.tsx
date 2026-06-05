import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readPublishedSite, isValidSubdomain } from "@/lib/sites/storage";
import { RestaurantReservation } from "@/templates/restaurant/RestaurantReservation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subdomain } = await params;
  if (!isValidSubdomain(subdomain)) return {};
  const site = await readPublishedSite(subdomain);
  if (!site) return {};
  const title = `Reservations — ${site.data.name}`;
  const description = `Book a table at ${site.data.name}. Reservation form, opening hours, contact details, and restaurant policies.`;
  return {
    metadataBase: new URL(site.meta.canonical),
    title,
    description,
    alternates: {
      canonical: `${site.meta.canonical.replace(/\/$/, "")}/reservation`,
    },
    openGraph: {
      title,
      description,
      url: `${site.meta.canonical.replace(/\/$/, "")}/reservation`,
      siteName: site.data.name,
      type: "website",
      images: site.meta.ogImage ? [{ url: site.meta.ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: site.meta.ogImage ? [site.meta.ogImage] : undefined,
    },
  };
}

export default async function SubdomainReservationPage({ params }: Params) {
  const { subdomain } = await params;
  if (!isValidSubdomain(subdomain)) notFound();
  const site = await readPublishedSite(subdomain);
  if (!site) notFound();
  return <RestaurantReservation site={site} />;
}
