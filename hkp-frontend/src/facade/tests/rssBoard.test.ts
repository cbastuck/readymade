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
 * The second is that **saving and removing are one entry point**. Both are the
 * same request with a different intent, and the two statements that act on it
 * are tracks of one service: independent of each other, given the same
 * request, and followed by a reducer that carries the request on — so the query
 * after them re-reads whatever changed, in the same pass, and the list a person
 * sees is the state after their own tap.
 */

type Service = { uuid: string; serviceId: string; state?: any };

const services = board.services.node as Service[];
const order = services.map((svc) => svc.uuid);

/** The service holding the statements that change rows, and its tracks. */
const record = services.find((svc) => svc.uuid === "record-article") as Service;
const tracks = (record?.state?.tracks ?? []) as Array<{
  name: string;
  pipeline: Array<{ instanceId: string; serviceId: string; state: any }>;
}>;

/** Every sql statement the board runs, top-level and inside a track alike. */
function statements(): Array<{ uuid: string; state: any }> {
  const found: Array<{ uuid: string; state: any }> = [];
  for (const svc of services) {
    if (svc.serviceId === "sql") {
      found.push({ uuid: svc.uuid, state: svc.state });
    }
    for (const track of (svc.state?.tracks ?? []) as typeof tracks) {
      for (const entry of track.pipeline) {
        if (entry.serviceId === "sql") {
          found.push({ uuid: entry.instanceId, state: entry.state });
        }
      }
    }
  }
  return found;
}

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
    for (const uuid of ["record-article", "kept-articles"]) {
      expect(order.indexOf(uuid)).toBeGreaterThan(stopper);
    }
  });

  it("keeps the statements that change rows independent of each other", () => {
    // They are given the same request and neither can see what the other did,
    // which is what lets each be read on its own. The guard stays in the
    // statement, where a condition about rows belongs.
    expect(record.serviceId).toBe("tracks");
    expect(tracks.map((track) => track.name)).toEqual(["keep", "drop"]);
    for (const track of tracks) {
      expect(track.pipeline).toHaveLength(1);
      expect(track.pipeline[0].serviceId).toBe("sql");
      expect(track.pipeline[0].state.mode).toBe("run");
      expect(track.pipeline[0].state.statement).toMatch(/\$intent/);
      // Carrying the pass is the reducer's job now, not every writer's.
      expect(track.pipeline[0].state.emit).toBeUndefined();
    }
  });

  it("carries the request on, so the list is read back in the same pass", () => {
    // The tracks were side effects: what leaves is the article the panel sent,
    // which is what the query after them reads.
    const reduce = record.state.reduce as Array<{ serviceId: string; state: any }>;
    expect(reduce).toHaveLength(1);
    expect(reduce[0].serviceId).toBe("map");
    expect(reduce[0].state.template).toEqual({ "=": "params.input" });

    const reading = services.find((svc) => svc.uuid === "kept-articles") as Service;
    expect(reading.state.mode).toBe("query");
    expect(order.indexOf("record-article")).toBeLessThan(order.indexOf("kept-articles"));
  });

  it("gives the reading list one entry point", () => {
    // Saving and removing are the same request, told apart by its intent, so
    // there is one service to send it to. A payload sent to a statement
    // directly would skip the one beside it and reach the query already acted
    // on — and now cannot be sent at all, since the statements are not
    // top-level services for a facade to name.
    const targets = new Set(collectProcessTargets(board.facade));
    expect(targets.has("record-article")).toBe(true);
    for (const track of tracks) {
      expect(targets.has(track.pipeline[0].instanceId)).toBe(false);
    }
  });

  it("shares one database across the statements, named rather than derived", () => {
    // Left empty the name comes from the board's title, which two boards can
    // share; naming it keeps this board alone with its reading list. The name
    // is a unit parameter, so what a statement holds is the reference and what
    // it runs with is the default — one name either way.
    const names = new Set(statements().map((svc) => svc.state.database));
    expect([...names]).toEqual(["{{param.database}}"]);
    expect((board as any).unit.params.database).toBe("rss-reader");
  });

  it("publishes the list as a feed, rebuilt by the act of changing it", () => {
    // The services that build and serve the document sit after the ones that
    // save and remove, so a save rebuilds the feed in its own pass — there is
    // nothing to schedule and nothing to invalidate.
    const feedServices = ["feed-about", "feed-doc", "feed-wrap", "feed-serve"];
    const changing = order.indexOf("record-article");

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
