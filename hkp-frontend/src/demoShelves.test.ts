import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DemoCatalogEntry } from "./demoCatalog";
import { findDemoBoard, findDemoUnits } from "./demoRegistry";
import { DEMO_SHELVES, membersOf, resolveShelf } from "./demoShelves";

const entry = (slug: string, extra: Partial<DemoCatalogEntry> = {}) => ({
  slug,
  label: slug,
  description: "",
  icon: "",
  tags: [],
  ...extra,
});

describe("resolveShelf", () => {
  const shelf = {
    id: "s",
    title: "Shelf",
    line: "",
    hero: "hero",
    picks: ["a", "b"],
  };

  it("puts the hero first and the picks after it, in order", () => {
    const resolved = resolveShelf(shelf, [
      entry("b"),
      entry("a"),
      entry("hero"),
    ]);
    expect(resolved.hero?.slug).toBe("hero");
    expect(resolved.picks.map((pick) => pick.slug)).toEqual(["a", "b"]);
    expect(resolved.missing).toEqual([]);
  });

  it("leaves out what the catalog does not have, and says which", () => {
    const resolved = resolveShelf(shelf, [entry("hero"), entry("b")]);
    expect(resolved.picks.map((pick) => pick.slug)).toEqual(["b"]);
    expect(resolved.missing).toEqual(["a"]);
  });

  it("leads with the first pick that exists while the hero does not", () => {
    const resolved = resolveShelf(shelf, [entry("a"), entry("b")]);
    expect(resolved.hero?.slug).toBe("a");
    expect(resolved.picks.map((pick) => pick.slug)).toEqual(["b"]);
    expect(resolved.missing).toEqual(["hero"]);
  });

  it("has no hero on a shelf nothing on which exists", () => {
    const resolved = resolveShelf(shelf, []);
    expect(resolved.hero).toBeUndefined();
    expect(resolved.picks).toEqual([]);
  });
});

describe("the shelves", () => {
  const shelved = DEMO_SHELVES.flatMap((shelf) => [shelf.hero, ...shelf.picks]);

  it("put every pick on one shelf only", () => {
    expect(new Set(shelved).size).toBe(shelved.length);
  });

  it("lead with a hero seen without setting anything up", () => {
    for (const shelf of DEMO_SHELVES) {
      const hero = DEMO_CATALOG.find((e) => e.slug === shelf.hero);
      if (hero) {
        expect(["browser", "video"], shelf.hero).toContain(hero.opens);
      }
    }
  });

  it("say how each pick that exists opens, and what you get", () => {
    for (const slug of shelved) {
      const pick = DEMO_CATALOG.find((e) => e.slug === slug);
      if (pick) {
        expect(pick.opens, slug).toBeDefined();
        expect(pick.outcome, slug).toBeTruthy();
        expect(pick.underTheHood, slug).toBeDefined();
      }
    }
  });

  // A video pick is listed before it is shot: until then its card is text,
  // or a still of the board, and the board to run yourself.
  it("give a video pick the board to run it yourself", () => {
    for (const pick of DEMO_CATALOG.filter((e) => e.opens === "video")) {
      expect(pick.runItYourself, pick.slug).toBeDefined();
    }
  });

  it("only name boards that are registered", () => {
    for (const pick of DEMO_CATALOG.filter((e) => e.opens)) {
      expect(findDemoBoard(pick.slug), pick.slug).toBeDefined();
      for (const member of membersOf(pick)) {
        expect(findDemoBoard(member.slug), member.slug).toBeDefined();
      }
      expect(membersOf(pick).length, pick.slug).toBe(
        pick.members?.length ?? 0,
      );
    }
  });

  // A demo opens at no URL, so a composed one has nowhere to find its units
  // but what the registry hands over with it.
  it("carry every unit a composed pick is made of", () => {
    for (const pick of DEMO_CATALOG.filter((e) => e.opens)) {
      const board = findDemoBoard(pick.slug) as { units?: { uri: string }[] };
      for (const { uri } of board?.units ?? []) {
        expect(findDemoUnits(pick.slug)?.[uri], `${pick.slug}: ${uri}`).toBeDefined();
      }
    }
  });
});
