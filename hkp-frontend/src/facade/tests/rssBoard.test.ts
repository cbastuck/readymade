import { describe, expect, it } from "vitest";

import board from "../../../boards/rss-demo-board.json";

/**
 * The RSS aggregator's wiring, as the board relies on it.
 *
 * Two arrangements carry this board and neither is visible from any one
 * service, so they are pinned here.
 *
 * The first is that **the refresh is a read**. A round of fetches ends in a
 * Stopper, so the article list is notified and goes no further; without it
 * every refresh would push sixty articles into the reading list's INSERT.
 *
 * The second is that **the reading list has one entry point**. Saving and
 * removing both process the first of the three statements, and the intent they
 * carry decides which one acts — so the query at the end re-reads whatever
 * changed, in the same pass, and the list a person sees is the state after
 * their own tap.
 */

type Service = { uuid: string; serviceId: string };

const services = board.services.node as Service[];
const order = services.map((svc) => svc.uuid);

/** Every serviceUuid a facade layout mentions, however deeply nested. */
function referencedUuids(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => referencedUuids(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "serviceUuid" && typeof value === "string") {
        found.add(value);
      } else {
        referencedUuids(value, found);
      }
    }
  }
  return found;
}

/** Every service the facade asks to do something, as opposed to read from. */
function collectProcessTargets(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectProcessTargets(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.type === "process" && typeof record.serviceUuid === "string") {
      found.push(record.serviceUuid);
    }
    Object.values(record).forEach((value) =>
      collectProcessTargets(value, found),
    );
  }
  return found;
}

describe("the RSS aggregator board", () => {
  it("references only services it declares", () => {
    const referenced = [...referencedUuids(board.facade)].sort();
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((uuid) => !order.includes(uuid))).toEqual([]);
  });

  it("ends the refresh in a stopper, before the reading list's statements", () => {
    const stopper = order.indexOf("end-refresh");
    expect(services[stopper].serviceId).toBe("stopper");
    // The fetch is before it, so a refresh reaches the stopper …
    expect(order.indexOf("feeds")).toBeLessThan(stopper);
    // … and every statement is after it, so a refresh never reaches one.
    for (const uuid of ["keep-article", "drop-article", "kept-articles"]) {
      expect(order.indexOf(uuid)).toBeGreaterThan(stopper);
    }
  });

  it("passes the request through each statement, ending in the query", () => {
    const statements = services.filter((svc) => svc.serviceId === "sql");

    // Each statement that changes rows steps out of the way of the request, so
    // the ones after it are handed the article and not its own { changes }.
    for (const svc of statements.slice(0, -1)) {
      const state = (svc as any).state;
      expect([svc.uuid, state.mode, state.emit]).toEqual([
        svc.uuid,
        "run",
        "input",
      ]);
    }
    expect((statements[statements.length - 1] as any).state.mode).toBe("query");
  });

  it("gives the reading list one entry point, at the head of the statements", () => {
    const statements = services
      .filter((svc) => svc.serviceId === "sql")
      .map((svc) => svc.uuid);

    // Everything the facade asks a service to *do*, as opposed to read.
    const processed = new Set(
      collectProcessTargets(board.facade).filter((uuid) =>
        statements.includes(uuid),
      ),
    );

    // Only the first. A payload sent to one in the middle would skip the
    // statement before it, and the rest would be handed a request that had
    // already been acted on.
    expect([...processed]).toEqual([statements[0]]);
    expect(statements[0]).toBe("keep-article");
  });

  it("shares one database across the statements, named rather than derived", () => {
    // Left empty the name comes from the board's title, which two boards can
    // share; naming it keeps this board alone with its reading list.
    const names = new Set(
      services
        .filter((svc) => svc.serviceId === "sql")
        .map((svc) => (svc as any).state.database),
    );
    expect([...names]).toEqual(["rss-reader"]);
  });

  it("fetches on load, so it reads as a reader and not as a form", () => {
    expect(board.facade.init).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "process", serviceUuid: "feeds" }),
      ]),
    );
  });

  it("subscribes to Hacker News out of the box", () => {
    const feeds = (services[0] as any).state.feeds as { url: string }[];
    expect(feeds.some((feed) => feed.url.includes("hnrss.org"))).toBe(true);
  });
});
