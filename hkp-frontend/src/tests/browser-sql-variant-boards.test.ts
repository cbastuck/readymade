import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { defaultRegistry } from "../runtime/browser/registry/Default";

/**
 * The browser variants of Private Health Log and Meeting Poll.
 *
 * Like Court Booking (Browser), each is the other board with the runtime taken
 * away, so the test that matters is that the two have not drifted apart. What
 * a variant may not share is the engine: every service it names, nested ones
 * included, has to be one the browser itself provides.
 *
 * The Health Log adds one thing: exporting its database as a `.sqlite` file,
 * because in a browser that is the only way the history leaves this device.
 */

function board(name: string) {
  return JSON.parse(readFileSync(`../boards/${name}`, "utf-8"));
}

/** Every serviceId in a board's services, at any depth. */
function serviceIds(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item) => serviceIds(item, into));
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.serviceId === "string") {
      into.push(record.serviceId);
    }
    Object.values(record).forEach((item) => serviceIds(item, into));
  }
  return into;
}

/** The services as hkp-node names them: the one id the browser spells
 *  differently is the Monitor's. */
function asNodeNames(services: unknown): unknown {
  return JSON.parse(
    JSON.stringify(services).replaceAll(
      '"serviceId":"hookup.to/service/monitor"',
      '"serviceId":"monitor"',
    ),
  );
}

const EXPORT = "export-file";

/** A board without the browser's export: its sub-service and its button. */
function withoutExport(value: any): any {
  if (Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          item?.uuid !== EXPORT &&
          !item?.actions?.some((action: any) => action.serviceUuid === EXPORT),
      )
      .map(withoutExport);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, withoutExport(item)]),
    );
  }
  return value;
}

/** The Health Log's text above the table, which also mentions the export. */
const EXPORT_NOTE =
  " Export saves the whole database as a .sqlite file, which any SQLite tool opens.";

const VARIANTS = [
  ["health-log-browser-demo-board.json", "health-log-demo-board.json"],
  ["meeting-poll-browser-demo-board.json", "meeting-poll-demo-board.json"],
];

describe.each(VARIANTS)("%s", (browserFile, nodeFile) => {
  const browserBoard = board(browserFile);
  const nodeBoard = board(nodeFile);

  it("presents the same app as the board that needs a runtime", () => {
    const facade = JSON.parse(
      JSON.stringify(withoutExport(browserBoard.facade)).replace(EXPORT_NOTE, ""),
    );
    expect(facade).toEqual(nodeBoard.facade);
  });

  it("runs the same statements", () => {
    expect(asNodeNames(withoutExport(browserBoard.services))).toEqual(
      nodeBoard.services,
    );
  });

  it("runs on the browser alone", () => {
    expect(browserBoard.runtimes).toHaveLength(1);
    expect(browserBoard.runtimes[0].type).toBe("browser");
    expect(browserBoard.runtimes[0].remote).toBeUndefined();
    expect(Object.keys(browserBoard.services)).toEqual([
      browserBoard.runtimes[0].id,
    ]);
  });

  it("names only services the browser registry provides", () => {
    const available = new Set(defaultRegistry.map((svc) => svc.serviceId));
    for (const id of serviceIds(browserBoard.services)) {
      expect(available, id).toContain(id);
    }
  });
});

describe("the browser Health Log's export", () => {
  const browserBoard = board("health-log-browser-demo-board.json");
  const exporter = browserBoard.services.health[0];

  it("comes first and stops there, so no entry ever reaches it", () => {
    // Only its own button enters the pipeline here; everything else enters
    // further down and flows away from it.
    expect(exporter.uuid).toBe(EXPORT);
    expect(exporter.state.stopPropagation).toBe(true);
  });

  it("saves the board's own database as an SQLite file", () => {
    const [sql, save] = exporter.state.pipeline;
    expect(sql.state).toMatchObject({
      mode: "export",
      format: "sqlite",
      database: browserBoard.services.health[1].state.database,
    });
    expect(save.serviceId).toBe("hookup.to/service/download");
    expect(save.state.filename).toMatch(/\.sqlite$/);
  });
});
