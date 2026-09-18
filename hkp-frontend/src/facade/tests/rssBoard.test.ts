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

  it("passes the request through every statement that changes rows", () => {
    const statements = services.filter((svc) => svc.serviceId === "sql");

    // Each statement that changes rows steps out of the way of the request, so
    // the ones after it are handed the article and not its own { changes }.
    for (const svc of statements) {
      const state = (svc as any).state;
      if (state.mode === "run") {
        expect([svc.uuid, state.emit]).toEqual([svc.uuid, "input"]);
      }
    }

    // The reading list is read back in the same pass that changed it, so the
    // list a person sees is the state after their own tap.
    const reading = statements.findIndex((svc) => svc.uuid === "kept-articles");
    const changing = statements
      .map((svc, index) => ((svc as any).state.mode === "run" ? index : -1))
      .filter((index) => index >= 0);
    expect((statements[reading] as any).state.mode).toBe("query");
    expect(Math.max(...changing)).toBeLessThan(reading);
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
    // share; naming it keeps this board alone with its reading list. The name
    // is a unit parameter, so what a statement holds is the reference and what
    // it runs with is the default — one name either way.
    const names = new Set(
      services
        .filter((svc) => svc.serviceId === "sql")
        .map((svc) => (svc as any).state.database),
    );
    expect([...names]).toEqual(["{{param.database}}"]);
    expect((board as any).unit.params.database).toBe("rss-reader");
  });

  it("publishes the list as a feed, rebuilt by the act of changing it", () => {
    // The services that build and serve the document sit after the ones that
    // save and remove, so a save rebuilds the feed in its own pass — there is
    // nothing to schedule and nothing to invalidate.
    const feedServices = ["feed-about", "feed-doc", "feed-wrap", "feed-serve"];
    const changing = order.indexOf("drop-article");

    for (const uuid of feedServices) {
      expect(order.indexOf(uuid)).toBeGreaterThan(changing);
    }

    const serve = services.find((svc) => svc.uuid === "feed-serve") as any;
    // Serving the last document it was handed, which is what makes the board
    // able to answer a subscriber without rebuilding anything per request.
    expect(serve.state.mode).toBe("process_on_data");
    // And it is last, because an endpoint in that mode answers with whatever
    // its chain returns.
    expect(order[order.length - 1]).toBe("feed-serve");
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
