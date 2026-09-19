import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import TracksUI from "../ui/TracksUI";
import { findServiceUI } from "../UIRegistry";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

/**
 * A Tracks service on another runtime.
 *
 * The generic editor looks for a `pipeline` and finds none, so a service with
 * three of them was drawn as an empty container — the reader board's keep and
 * drop statements were there and unreachable. Two things keep that from coming
 * back: the registry has to choose this panel for the service, and the panel
 * has to draw every pipeline the service holds.
 */

const STATE = {
  run: "serial",
  tracks: [
    {
      name: "keep",
      bypass: false,
      pipeline: [{ serviceId: "sql", instanceId: "insert", state: {} }],
    },
    {
      name: "drop",
      bypass: false,
      pipeline: [{ serviceId: "sql", instanceId: "delete", state: {} }],
    },
  ],
  reduce: [{ serviceId: "map", instanceId: "carry", state: {} }],
  error: "",
};

function tracksProps() {
  const service = {
    uuid: "record-article",
    serviceId: "tracks",
    serviceName: "Keep or drop",
    board: "RSS Aggregator",
    state: STATE,
    configure: vi.fn().mockResolvedValue(undefined),
    getConfiguration: async () => STATE,
    process: async () => {},
    destroy: async () => {},
    app: {
      listAvailableServices: () => [
        { serviceId: "map", serviceName: "Map" },
        { serviceId: "sql", serviceName: "SQL" },
      ],
      registerNotificationTarget: () => () => {},
    },
  } as unknown as ServiceInstance;
  return { service } as unknown as ServiceUIProps;
}

describe("a Tracks service on a REST runtime", () => {
  it("is drawn by the panel that knows where its pipelines are", () => {
    expect(findServiceUI({ serviceId: "tracks", version: "v1" })).toBe(TracksUI);
    expect(findServiceUI("tracks")).toBe(TracksUI);
  });

  it("names every track, and the reducer beside them", async () => {
    render(<TracksUI {...tracksProps()} />);

    expect(await screen.findByText("keep")).toBeTruthy();
    expect(screen.getByText("drop")).toBeTruthy();
    expect(screen.getByText("reduce")).toBeTruthy();
    // Not "Empty container", which is what a panel looking for `pipeline` says
    // about a service that keeps its pipelines somewhere else.
    expect(screen.queryByText("Empty container")).toBeNull();
  });
});
