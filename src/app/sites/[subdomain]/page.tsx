import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readPublishedSite, isValidSubdomain } from "@/lib/sites/storage";
import { RestaurantTemplate } from "@/templates/restaurant/RestaurantTemplate";

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
  return {
    title: site.meta.title,
    description: site.meta.description,
    alternates: { canonical: site.meta.canonical },
    openGraph: {
      title: site.meta.title,
      description: site.meta.description,
      url: site.meta.canonical,
      images: site.meta.ogImage ? [{ url: site.meta.ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: site.meta.title,
      description: site.meta.description,
    },
  };
}

export default async function SubdomainPage({ params }: Params) {
  const { subdomain } = await params;
  if (!isValidSubdomain(subdomain)) notFound();
  const site = await readPublishedSite(subdomain);
  if (!site) notFound();

  switch (site.data.industry) {
    case "restaurant":
      return <RestaurantTemplate site={site} />;
    default:
      // fallback render for industries without a dedicated template yet
      return <RestaurantTemplate site={site as never} />;
  }
}
