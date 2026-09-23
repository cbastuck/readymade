import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import NestedNavProvider from "../NestedNavigation";
import NamedPipelinesPanel from "../NamedPipelinesPanel";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * The panel a service with more than one pipeline is drawn with.
 *
 * Its one hard requirement is that an edit made inside a pipeline arrives
 * tagged with the pipeline it was made in. Two proxies stand between a nested
 * service's panel and the service: the entry's, which turns an edit into
 * `configureService`, and this panel's, which says which pipeline that was
 * about. Untagged, an edit would land on whichever pipeline the service
 * treated as its own.
 *
 * Tracks and the HTTP endpoint both read this way — a track per branch, an
 * entry point per side — so what is pinned here is the arrangement rather than
 * either service.
 */

const sections = [
  {
    name: "onProcess",
    pipeline: [{ serviceId: "hold", instanceId: "keep-document" }],
  },
  {
    name: "onRequest",
    pipeline: [{ serviceId: "hold", instanceId: "serve-document" }],
  },
];

/** A nested panel with one control: change something about this service. */
const StubUI = ({ service }: any) => (
  <button onClick={() => service.configure({ op: "read" })}>
    edit {service.uuid}
  </button>
);

function host(): ServiceInstance {
  return {
    uuid: "feed-serve",
    serviceId: "http-server-subservices",
    serviceName: "Serve the feed",
    board: "RSS Aggregator",
    app: {
      listAvailableServices: () => [{ serviceId: "hold", serviceName: "Hold" }],
    },
  } as unknown as ServiceInstance;
}

function renderPanel(
  onEdit: (name: string, payload: any) => void,
  options: {
    defaultOpen?: string;
    wrap?: (node: React.ReactElement) => React.ReactElement;
  } = {},
) {
  const wrap = options.wrap ?? ((node: React.ReactElement) => node);
  return render(
    wrap(
      <NamedPipelinesPanel
        service={host()}
        sections={sections}
        defaultOpen={options.defaultOpen}
        findServiceUI={() => StubUI as any}
        onEdit={onEdit}
      />,
    ),
  );
}

describe("the named-pipelines panel", () => {
  it("tags an edit with the pipeline it was made in", () => {
    const onEdit = vi.fn();
    renderPanel(onEdit, { defaultOpen: "onRequest" });

    fireEvent.click(screen.getByText("edit serve-document"));

    expect(onEdit).toHaveBeenCalledWith("onRequest", {
      configureService: {
        instanceId: "serve-document",
        state: { op: "read" },
      },
    });
  });

  it("keeps each pipeline's services to itself", () => {
    const onEdit = vi.fn();
    renderPanel(onEdit, { defaultOpen: "onRequest" });

    // Shut, a pipeline shows nothing; opened, it shows its own and no other's.
    expect(screen.queryByText("edit keep-document")).toBeNull();
    fireEvent.click(screen.getByText("onProcess"));
    expect(screen.getByText("edit keep-document")).toBeTruthy();

    fireEvent.click(screen.getByText("edit keep-document"));
    expect(onEdit).toHaveBeenCalledWith(
      "onProcess",
      expect.objectContaining({
        configureService: expect.objectContaining({
          instanceId: "keep-document",
        }),
      }),
    );
  });

  it("opens the first section when nothing says otherwise", () => {
    renderPanel(vi.fn());
    expect(screen.getByText("edit keep-document")).toBeTruthy();
    expect(screen.queryByText("edit serve-document")).toBeNull();
  });

  it("opens a pipeline on a level of its own, from its own row", () => {
    // The button sits beside the fold rather than on a row of its own inside
    // the pipeline, where it would be the only thing on that row.
    renderPanel(vi.fn(), {
      defaultOpen: "onRequest",
      wrap: (node) => (
        <NestedNavProvider rootLabel="Board">{node}</NestedNavProvider>
      ),
    });

    fireEvent.click(
      screen.getByTitle("Open Serve the feed · onRequest as its own level"),
    );

    const trail = within(
      screen.getByRole("navigation", { name: "Nested pipeline" }),
    );
    expect(trail.getByText("Board")).toBeTruthy();
    expect(trail.getByText("Serve the feed · onRequest")).toBeTruthy();
    // The pipeline itself moved to the level: its services are drawn there.
    expect(screen.getAllByText("edit serve-document").length).toBeGreaterThan(0);
  });
});
