import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import NestedNavProvider from "../NestedNavigation";
import TracksPanel from "../TracksPanel";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * The panel both runtimes draw a Tracks service with.
 *
 * Its one hard requirement is that an edit made inside a track arrives tagged
 * with the track it was made in. Two proxies stand between a nested service's
 * panel and the service: the entry's, which turns an edit into
 * `configureService`, and the track's, which says which track that was about.
 * Untagged, an edit would land on whichever pipeline the service treated as
 * its own.
 */

const tracks = [
  { name: "keep", pipeline: [{ serviceId: "sql", instanceId: "insert" }] },
  { name: "drop", pipeline: [{ serviceId: "sql", instanceId: "delete" }] },
];

/** A nested panel with one control: change something about this service. */
const StubUI = ({ service }: any) => (
  <button onClick={() => service.configure({ statement: "SELECT 1" })}>
    edit {service.uuid}
  </button>
);

function host(): ServiceInstance {
  return {
    uuid: "record-article",
    serviceId: "tracks",
    serviceName: "Keep or drop",
    board: "RSS Aggregator",
    app: {
      listAvailableServices: () => [{ serviceId: "sql", serviceName: "SQL" }],
    },
  } as unknown as ServiceInstance;
}

function renderPanel(
  onTrackEdit: (track: string, payload: any) => void,
  wrap: (node: React.ReactElement) => React.ReactElement = (node) => node,
) {
  return render(
    wrap(
    <TracksPanel
      service={host()}
      tracks={tracks}
      reduce={[]}
      run="serial"
      findServiceUI={() => StubUI as any}
      onRun={() => {}}
      onTrackEdit={onTrackEdit}
    />,
    ),
  );
}

describe("the Tracks panel", () => {
  it("tags an edit with the track it was made in", () => {
    const onTrackEdit = vi.fn();
    renderPanel(onTrackEdit);

    // The first track is open, so its services are on screen already.
    fireEvent.click(screen.getByText("edit insert"));

    expect(onTrackEdit).toHaveBeenCalledWith("keep", {
      configureService: {
        instanceId: "insert",
        state: { statement: "SELECT 1" },
      },
    });
  });

  it("keeps each track's services to itself", () => {
    const onTrackEdit = vi.fn();
    renderPanel(onTrackEdit);

    // Shut, a track shows nothing; opened, it shows its own and no other's.
    expect(screen.queryByText("edit delete")).toBeNull();
    fireEvent.click(screen.getByText("drop"));
    expect(screen.getByText("edit delete")).toBeTruthy();

    fireEvent.click(screen.getByText("edit delete"));
    expect(onTrackEdit).toHaveBeenCalledWith(
      "drop",
      expect.objectContaining({
        configureService: expect.objectContaining({ instanceId: "delete" }),
      }),
    );
  });

  it("opens a track on a level of its own, from the track's own row", () => {
    // The button sits beside the fold rather than on a row of its own inside
    // the pipeline, where it would be the only thing on that row.
    renderPanel(vi.fn(), (node) => (
      <NestedNavProvider rootLabel="Board">{node}</NestedNavProvider>
    ));

    fireEvent.click(
      screen.getByTitle("Open Keep or drop · keep as its own level"),
    );

    const trail = within(
      screen.getByRole("navigation", { name: "Nested pipeline" }),
    );
    expect(trail.getByText("Board")).toBeTruthy();
    expect(trail.getByText("Keep or drop · keep")).toBeTruthy();
    // The pipeline itself moved to the level: its services are drawn there.
    expect(screen.getAllByText("edit insert").length).toBeGreaterThan(0);
  });
});
