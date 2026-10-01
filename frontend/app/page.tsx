import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/home/hero";
import { FeaturedEvents } from "@/components/home/featured-events";
import { SiteFooter } from "@/components/layout/site-footer";
import { listCategories } from "@/lib/api/categories";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { apiEventToFeatured, type FeaturedEvent } from "@/lib/mappers/event-mappers";

// Bug corrigé : sans ça, `next build` fige cette page au moment du build,
// API injoignable → liste vide servie à tout le monde, indéfiniment.
// Invisible en `next dev`, qui rend chaque requête.
export const dynamic = "force-dynamic";

// Bug corrigé : "À la une" affichait des événements factices (dont
// "Roméo et Juliette", id "romeo-et-juliette") — cliquables depuis que
// EventCard mène à /evenements/[id], ils menaient donc systématiquement à
// une page 404 puisque cet id n'existe pas côté event-service.
const FEATURED_LIMIT = 10;

export default async function Home() {
  let featured: FeaturedEvent[] = [];
  try {
    const [{ data }, referential] = await Promise.all([
      listPublishedEvents({}),
      // Libellés des catégories tels que définis par l'administration.
      listCategories().catch(() => []),
    ]);
    const withCategories = await Promise.all(
      data.slice(0, FEATURED_LIMIT).map(async (event) => {
        const categories = await getEventCategories(event.id).catch(() => []);
        return apiEventToFeatured(event, categories, referential);
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
        <FeaturedEvents events={featured} />
      </main>
      <SiteFooter />
    </div>
  );
}
