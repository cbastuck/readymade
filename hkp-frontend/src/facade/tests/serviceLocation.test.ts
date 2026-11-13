import { describe, expect, it } from "vitest";

import { buildScene } from "hkp-frontend/src/overview/graph";
import type { BlockLinkage } from "hkp-frontend/src/runtime/board/blocks";
import {
  locateService,
  revealTargetOf,
  ServiceLocation,
} from "../serviceLocation";

/**
 * Where a service a facade names lives, as the board names it, and whether a
 * binding to it resolves.
 */

const runtimes = [
  { id: "ui", name: "Browser", type: "browser" },
  { id: "node", name: "Node", type: "rest" },
] as any;

const services = {
  ui: [{ uuid: "form", serviceId: "monitor", serviceName: "Form" }],
  node: [
    {
      uuid: "route",
      serviceId: "switch",
      serviceName: "Switch",
      state: {
        cases: [
          {
            name: 'case "paid"',
            pipeline: [
              { instanceId: "mailer", serviceId: "smtp", serviceName: "Mailer" },
            ],
          },
          {
            name: 'case "free"',
            pipeline: [
              { instanceId: "log", serviceId: "monitor", serviceName: "Log" },
            ],
          },
        ],
      },
    },
    {
      uuid: "read",
      serviceId: "sub-service",
      serviceName: "Read",
      state: {
        pipeline: [
          {
            instanceId: "kept-articles",
            serviceId: "sql",
            serviceName: "Kept articles",
          },
        ],
      },
    },
  ],
} as any;

const scene = buildScene(runtimes, services);
const reachable = () => true;

function locate(
  address: string,
  options: Partial<Parameters<typeof locateService>[2]> = {},
): ServiceLocation {
  return locateService(scene, address, {
    settled: true,
    isReachable: reachable,
    ...options,
  });
}

describe("where a service lives", () => {
  it("names a top-level service by its runtime", () => {
    const found = locate("form");
    expect(found.status).toBe("found");
    expect(found.status === "found" && found.breadcrumb).toEqual([
      { label: "Browser", kind: "runtime" },
      { label: "Form", kind: "service" },
    ]);
  });

  it("names the hosts above a nested one, and which of a host's pipelines it is in", () => {
    const found = locate("route.mailer");
    expect(found.status === "found" && found.breadcrumb.map((c) => c.label)).toEqual([
      "Node",
      "Switch",
      'case "paid"',
      "Mailer",
    ]);
  });

  it("leaves out the name of a host's only pipeline", () => {
    const found = locate("read.kept-articles");
    expect(found.status === "found" && found.breadcrumb.map((c) => c.label)).toEqual([
      "Node",
      "Read",
      "Kept articles",
    ]);
  });

  it("is pending until the board's shape has been read, then missing", () => {
    expect(locate("nowhere", { settled: false }).status).toBe("pending");
    expect(locate("nowhere").status).toBe("missing");
    expect(
      locateService(null, "form", { settled: true, isReachable: reachable }).status,
    ).toBe("pending");
  });

  it("says when its runtime cannot be reached", () => {
    const location = locate("route.log", {
      isReachable: (address) => !address.startsWith("route"),
    });
    expect(location.status).toBe("unreachable");
    expect(
      location.status === "unreachable" && location.breadcrumb.at(-1)?.label,
    ).toBe("Log");
  });

  it("points at the use as a whole for a service inside one", () => {
    const linkage = {
      definitions: {},
      placed: [
        {
          key: "use-1",
          runtimeId: "node",
          path: [],
          address: "read",
          id: "read",
          use: { block: "reader" },
          document: "board",
        },
      ],
    } as unknown as BlockLinkage;

    const location = locate("read.kept-articles", { linkage });
    expect(location).toMatchObject({
      status: "inside-use",
      block: "reader",
      use: { address: "read" },
    });
    expect(
      location.status === "inside-use" && location.breadcrumb.map((c) => c.label),
    ).toEqual(["Node", "Read"]);
    expect(revealTargetOf(location)).toMatchObject({ uuid: "read", ancestry: [] });
  });
});

describe("what a location reveals", () => {
  it("opens the hosts above a nested service, named as the board names them", () => {
    const target = revealTargetOf(locate("route.mailer"));
    expect(target).toMatchObject({ uuid: "mailer", ancestry: ["route"] });
    expect(target?.hostLabel(0)).toBe("Switch");
  });

  it("reveals nothing for a service the board does not have", () => {
    expect(revealTargetOf(locate("nowhere"))).toBeNull();
  });
});
