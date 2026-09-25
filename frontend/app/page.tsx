import { Navbar } from "@/components/layout/navbar";
import { BuyerOnlyGate } from "@/components/layout/buyer-only-gate";
import { Hero } from "@/components/home/hero";
import { FeaturedEvents } from "@/components/home/featured-events";
import { SiteFooter } from "@/components/layout/site-footer";
import { getEventCategories, listPublishedEvents } from "@/lib/api/events";
import { apiEventToCard } from "@/lib/mappers/event-mappers";

// Bug corrigé : "À la une" affichait des événements factices (dont
// "Roméo et Juliette", id "romeo-et-juliette") — cliquables depuis que
// EventCard mène à /evenements/[id], ils menaient donc systématiquement à
// une page 404 puisque cet id n'existe pas côté event-service.
const FEATURED_LIMIT = 6;

export default async function Home() {
  let featured: ReturnType<typeof apiEventToCard>[] = [];
  try {
    const { data } = await listPublishedEvents({});
    const withCategories = await Promise.all(
      data.slice(0, FEATURED_LIMIT).map(async (event) => {
        const categories = await getEventCategories(event.id).catch(() => []);
        return apiEventToCard(event, categories);
      }),
    );
    featured = withCategories;
  } catch {
    // Le catalogue reste utilisable même si cette section échoue à charger.
    featured = [];
  }

  return (
    <BuyerOnlyGate>
      <div className="flex flex-1 flex-col bg-[#07060c]">
        <Navbar active="/catalogue" />
        <main className="flex-1">
          <Hero />
          <FeaturedEvents events={featured} />
        </main>
        <SiteFooter />
      </div>
    </BuyerOnlyGate>
  );
}
