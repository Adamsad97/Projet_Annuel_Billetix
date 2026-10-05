import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/home/hero";
import { FeaturedEvents } from "@/components/home/featured-events";
import { CategoryExplorer } from "@/components/home/category-explorer";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCategoryCounts, listCategories, type ApiCategory } from "@/lib/api/categories";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { apiEventToFeatured, type FeaturedEvent } from "@/lib/mappers/event-mappers";
import { getLocale } from "@/lib/i18n/server";

// Rendu à chaque requête, sinon next build figerait une liste vide.
export const dynamic = "force-dynamic";

// « À la une » affiche de vrais événements.
const FEATURED_LIMIT = 10;

export default async function Home() {
  const locale = await getLocale();
  let featured: FeaturedEvent[] = [];
  // Sélection « À la une » de l'admin ; s'il n'en a fait aucune, les
  // prochains événements (l'accueil n'est jamais vide).
  let curated = false;
  let categories: ApiCategory[] = [];
  let categoryCounts: Record<string, number> = {};
  try {
    const [selection, referential, counts] = await Promise.all([
      listPublishedEvents({ featured: true }),
      // Libellés des catégories tels que définis par l'administration.
      listCategories().catch(() => []),
      getCategoryCounts().catch(() => ({})),
    ]);
    categories = referential;
    categoryCounts = counts;
    curated = selection.data.length > 0;
    const { data } = curated ? selection : await listPublishedEvents({});
    const withCategories = await Promise.all(
      data.slice(0, FEATURED_LIMIT).map(async (event) => {
        const categories = await getEventCategories(event.id).catch(() => []);
        return apiEventToFeatured(event, categories, referential, locale);
      }),
    );
    featured = withCategories;
  } catch {
    // Le catalogue reste utilisable même si cette section échoue à charger.
    featured = [];
  }

  return (
    <div className="flex flex-1 flex-col bg-page">
      <Navbar active="/evenements" />
      <main className="flex-1">
        <Hero />
        <FeaturedEvents events={featured} curated={curated} categories={categories} categoryCounts={categoryCounts} />
        <CategoryExplorer categories={categories} counts={categoryCounts} />
      </main>
      <SiteFooter />
    </div>
  );
}
