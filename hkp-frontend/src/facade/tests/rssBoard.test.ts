import { describe, expect, it } from "vitest";

import board from "../../../../boards/rss-demo-board.json";

/**
 * The RSS aggregator's wiring, as the board relies on it.
 *
 * Two arrangements carry this board and neither is visible from any one
 * service, so they are pinned here.
 *
 * The first is that **the refresh is a read**. The fetch is a scope of its
 * own that passes nothing on, so the article list is notified and goes no
 * further; without that every refresh would push sixty articles into the
 * reading list's INSERT. It used to be a Stopper sitting between the two
 * halves, which said the same thing about the gap rather than about either
 * side of it.
 *
 * The second is that **saving and removing are one entry point**. Both are the
 * same request with a different intent, and the two statements that act on it
 * are tracks of one service: independent of each other, given the same
 * request, and followed by a reducer that carries the request on — so the query
 * after them re-reads whatever changed, in the same pass, and the list a person
 * sees is the state after their own tap.
 */

type Entry = {
  uuid: string;
  serviceId: string;
  serviceName?: string;
  state?: any;
};

const scopes = board.services.node as Entry[];

/** A scope by name, and the ordered services inside it. */
function scope(uuid: string): Entry {
  const found = scopes.find((svc) => svc.uuid === uuid);
  expect(found, `no scope called ${uuid}`).toBeTruthy();
  return found as Entry;
}

function inside(uuid: string): Entry[] {
  return (scope(uuid).state?.pipeline ?? []) as Entry[];
}

const listOrder = inside("list").map((svc) => svc.uuid);

/** The service holding the statements that change rows, and its tracks. */
const record = inside("list").find(
  (svc) => svc.uuid === "record-article",
) as Entry;
const tracks = (record?.state?.tracks ?? []) as Array<{
  name: string;
  pipeline: Array<{ instanceId: string; serviceId: string; state: any }>;
}>;

/** Every sql statement the board runs, in a scope or inside a track alike. */
function statements(): Array<{ uuid: string; state: any }> {
  const found: Array<{ uuid: string; state: any }> = [];
  for (const svc of [...inside("read"), ...inside("list")]) {
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

/** Every address the board can be asked about: a scope, or a service in one. */
function addressable(): string[] {
  const found: string[] = [];
  for (const s of scopes) {
    found.push(s.uuid);
    for (const nested of (s.state?.pipeline ?? []) as Entry[]) {
      found.push(`${s.uuid}.${nested.uuid}`);
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
    const declared = addressable();
    const referenced = [...referencedUuids(board.facade)].sort();
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((uuid) => !declared.includes(uuid))).toEqual([]);
  });

  it("is two scopes, and the read one passes nothing on", () => {
    // What the Stopper between them used to say, said by the flow that ends
    // rather than by the gap after it. The reading list is not reached from
    // here at all: it is entered by the facade addressing it.
    expect(scopes.map((svc) => svc.uuid)).toEqual(["read", "list"]);
    for (const svc of scopes) {
      expect(svc.serviceId).toBe("sub-service");
    }
    expect(scope("read").state.stopPropagation).toBe(true);
    expect(inside("read").map((svc) => svc.uuid)).toEqual(["feeds"]);
  });

  it("puts every statement out of the refresh's reach", () => {
    // Not by sitting after a stopper, but by being in the other scope — so a
    // service added to the refresh cannot land on the wrong side of a line.
    const readSide = inside("read").map((svc) => svc.uuid);
    for (const uuid of ["record-article", "kept-articles"]) {
      expect(listOrder).toContain(uuid);
      expect(readSide).not.toContain(uuid);
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

    const reading = inside("list").find(
      (svc) => svc.uuid === "kept-articles",
    ) as Entry;
    expect(reading.state.mode).toBe("query");
    expect(listOrder.indexOf("record-article")).toBeLessThan(
      listOrder.indexOf("kept-articles"),
    );
  });

  it("gives the reading list one entry point", () => {
    // Saving and removing are the same request, told apart by its intent, so
    // there is one service to send it to. A payload sent to a statement
    // directly would skip the one beside it and reach the query already acted
    // on.
    const targets = new Set(collectProcessTargets(board.facade));
    expect(targets.has("list.record-article")).toBe(true);
    for (const track of tracks) {
      expect(targets.has(track.pipeline[0].instanceId)).toBe(false);
    }
  });

  it("addresses a service in a scope by the path through it", () => {
    // The facade names what it reads and drives by where it sits, so moving a
    // service between scopes is visible in the board rather than silent.
    const referenced = [...referencedUuids(board.facade)].sort();
    expect(referenced).toEqual([
      "list.feed-serve",
      "list.kept-articles",
      "list.record-article",
      "read.feeds",
    ]);
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
    // save and remove, in the same scope, so a save rebuilds the feed in its
    // own pass — there is nothing to schedule and nothing to invalidate.
    const changing = listOrder.indexOf("record-article");
    for (const uuid of ["feed-about", "feed-doc", "feed-wrap", "feed-serve"]) {
      expect(listOrder.indexOf(uuid)).toBeGreaterThan(changing);
    }

    const serve = inside("list").find(
      (svc) => svc.uuid === "feed-serve",
    ) as any;
    // Serving the last document it was handed, which is what makes the board
    // able to answer a subscriber without rebuilding anything per request —
    // said as the two pipelines it is: the pass writes the document into a
    // slot, the request reads it back out.
    const writer = serve.state.onProcess[0];
    const reader = serve.state.onRequest[0];
    expect(writer.serviceId).toBe("hold");
    expect(reader.serviceId).toBe("hold");
    expect(writer.state.op).toBe("write");
    expect(reader.state.op).toBe("read");
    // Naming the same cell is the whole of what connects them: they sit in
    // pipelines that never meet.
    expect(reader.state.slot).toBe(writer.state.slot);
    // And it is last in its scope, because the services after an endpoint still
    // run on every request — a request should not drag a tail of SQL behind it.
    expect(listOrder[listOrder.length - 1]).toBe("feed-serve");
  });

  it("points at the endpoint by the address it now has", () => {
    // A mount reference names the service, and a service inside a scope is
    // named by the path through it — so nesting the endpoint changed the
    // reference that reaches it.
    const about = inside("list").find(
      (svc) => svc.uuid === "feed-about",
    ) as any;
    expect(about.state.template.channelLink).toBe(
      "hkp-mount://node/list.feed-serve",
    );
  });

  it("fetches on load, so it reads as a reader and not as a form", () => {
    expect(board.facade.init).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "process", serviceUuid: "read.feeds" }),
      ]),
    );
  });

  it("subscribes to Hacker News out of the box", () => {
    const feeds = inside("read")[0].state.feeds as { url: string }[];
    expect(feeds.some((feed) => feed.url.includes("hnrss.org"))).toBe(true);
  });
});
