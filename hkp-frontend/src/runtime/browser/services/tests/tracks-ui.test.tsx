import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import NestedNavProvider from "../../../ui/NestedNavigation";
import TracksUI from "../TracksUI";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * A panel per track, and one for the reducer.
 *
 * A service holding several pipelines has to show all of them: with one panel
 * for the service and none for what is inside it, the board's actual work
 * becomes unreachable — which is what happened to the game-of-life board when
 * its two branches moved from Stack to Tracks.
 */

function tracksService(state: Record<string, unknown>): ServiceInstance {
  return {
    uuid: "tracks-1",
    serviceId: "tracks",
    serviceName: "Tracks",
    board: "test-board",
    state,
    configure: vi.fn(),
    getConfiguration: vi.fn(async () => state),
    process: vi.fn(),
    destroy: vi.fn(),
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
      listAvailableServices: () => [
        { serviceId: "sub-service", serviceName: "Sub-Service" },
      ],
      notify: vi.fn(),
      sendAction: vi.fn(),
    },
  } as unknown as ServiceInstance;
}

const branches = {
  run: "serial",
  tracks: [
    {
      name: "visual-branch",
      pipeline: [{ serviceId: "sub-service", instanceId: "visual-branch" }],
    },
    {
      name: "audio-branch",
      pipeline: [{ serviceId: "sub-service", instanceId: "audio-branch" }],
    },
  ],
  reduce: [],
};

describe("the Tracks panel", () => {
  it("names every track, and the reducer beside them", async () => {
    const service = tracksService(branches);
    render(<TracksUI service={service} />);

    expect(await screen.findByText("visual-branch")).toBeTruthy();
    expect(screen.getByText("audio-branch")).toBeTruthy();
    // Shown empty or not: with nothing there the answers travel on as an
    // array, which is worth being able to see and change.
    expect(screen.getByText("reduce")).toBeTruthy();
  });

  it("opens the first track, and leaves the rest shut", async () => {
    // A panel showing nothing but a list of names says nothing about what the
    // service does.
    const service = tracksService(branches);
    render(
      <NestedNavProvider rootLabel="Board">
        <TracksUI service={service} />
      </NestedNavProvider>,
    );

    await screen.findByText("visual-branch");

    expect(
      screen.getByTitle("Open Tracks · visual-branch as its own level"),
    ).toBeTruthy();
    expect(
      screen.queryByTitle("Open Tracks · audio-branch as its own level"),
    ).toBeNull();
    expect(screen.queryByTitle("Open Tracks · reduce as its own level")).toBeNull();
  });

  it("folds a track by its name, and nothing else", async () => {
    // One control per track, not two: the strip's own fold would make a reader
    // open a track and then open its pipeline to see the same thing.
    const service = tracksService(branches);
    render(
      <NestedNavProvider rootLabel="Board">
        <TracksUI service={service} />
      </NestedNavProvider>,
    );

    const first = await screen.findByText("visual-branch");
    const second = screen.getByText("audio-branch");

    // The name shuts what it opened, and with every track shut the panel is
    // the list of names and nothing else — no fold of the strip's own left
    // over to open a second time.
    fireEvent.click(first);
    expect(
      screen.queryByTitle("Open Tracks · visual-branch as its own level"),
    ).toBeNull();
    expect(screen.queryByText(/Show nested sevices/)).toBeNull();

    // … and opens its neighbour without touching it.
    fireEvent.click(second);
    expect(
      screen.getByTitle("Open Tracks · audio-branch as its own level"),
    ).toBeTruthy();
    expect(
      screen.queryByTitle("Open Tracks · visual-branch as its own level"),
    ).toBeNull();
  });

  it("says so when there is nothing to run", async () => {
    render(<TracksUI service={tracksService({ run: "serial", tracks: [], reduce: [] })} />);

    expect(await screen.findByText(/No tracks configured/)).toBeTruthy();
  });
});
