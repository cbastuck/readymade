import { DEMO_CATALOG, DemoCatalogEntry } from "./demoCatalog";

/**
 * The shelves of the pitch's gallery: the range of what people build, named
 * after what you would build rather than the feature it shows. A visitor
 * counts shelves, not demos — each shows its hero, and opening it reveals the
 * rest of its picks. The picks are catalog entries by slug, so the gallery,
 * the start page and the board hub read the same ones.
 *
 * A slug may name a board that is not registered yet: the gallery leaves it
 * out (or shows it as missing, while drafting) until it is.
 */
export type DemoShelf = {
  id: string;
  title: string;
  line: string;
  /** Seen without setting anything up: opens in the browser, or plays as a
   *  video where trying it needs more than a visitor has — signing in, say. */
  hero: string;
  /** The rest of the shelf, in order, the hero not among them. */
  picks: string[];
};

export const DEMO_SHELVES: DemoShelf[] = [
  {
    id: "yourself",
    title: "For yourself",
    line: "Tools of your own, with your data where you keep it.",
    hero: "health-log-browser",
    picks: ["hacker-news", "rss-radio", "live-radio"],
  },
  {
    id: "together",
    title: "For your club, team and customers",
    line: "Apps several people use at once, each as themselves.",
    hero: "court-booking",
    picks: ["meeting-poll", "syn-mail-desk"],
  },
];

export type ResolvedShelf = {
  shelf: DemoShelf;
  /** The hero, or the first pick that exists while the hero does not. */
  hero: DemoCatalogEntry | undefined;
  /** The rest of the shelf that exists, in order, the hero not among them. */
  picks: DemoCatalogEntry[];
  /** Slugs on the shelf the catalog has no entry for yet. */
  missing: string[];
};

export function resolveShelf(
  shelf: DemoShelf,
  catalog: DemoCatalogEntry[] = DEMO_CATALOG,
): ResolvedShelf {
  const bySlug = new Map(catalog.map((entry) => [entry.slug, entry]));
  const slugs = [shelf.hero, ...shelf.picks];
  const found = slugs.flatMap((slug) => bySlug.get(slug) ?? []);
  const [hero, ...picks] = found;
  return {
    shelf,
    hero,
    picks,
    missing: slugs.filter((slug) => !bySlug.has(slug)),
  };
}

/** The boards a group pick shows beside itself, those that exist. */
export function membersOf(
  entry: DemoCatalogEntry,
  catalog: DemoCatalogEntry[] = DEMO_CATALOG,
): DemoCatalogEntry[] {
  return (entry.members ?? []).flatMap(
    (slug) => catalog.find((member) => member.slug === slug) ?? [],
  );
}
