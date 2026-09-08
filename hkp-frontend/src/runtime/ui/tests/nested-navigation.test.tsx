import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import NestedNavProvider from "../NestedNavigation";
import SubServicePipelineUI from "../SubServicePipelineUI";
import { MobileHostContext } from "hkp-frontend/src/MobileHostContext";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * A nested pipeline can be opened as a level of its own, and the breadcrumb
 * trail is the way back out.
 *
 * What the trail says has to stay true: a level whose host is gone is a route
 * to nothing, and a level opened from the same depth as another replaces it
 * rather than pretending to be deeper than it is.
 */

function host(
  uuid: string,
  serviceName: string,
  pipeline: Array<Record<string, unknown>>,
): ServiceInstance {
  return {
    uuid,
    serviceId: "sub-service",
    serviceName,
    state: { pipeline },
    configure: vi.fn(),
    app: {
      listAvailableServices: () => [{ serviceId: "map", serviceName: "Map" }],
    },
  } as unknown as ServiceInstance;
}

const StubUI = ({ service }: any) => <div>panel:{service.uuid}</div>;
const findServiceUI = () => StubUI as any;

const trail = () =>
  within(screen.getByRole("navigation", { name: "Nested pipeline" }));

const openButton = (label: string) =>
  screen.getByTitle(`Open ${label} as its own level`);

describe("nested pipeline navigation", () => {
  it("opens a pipeline as a level and names it in the trail", () => {
    render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI
          service={host("h1", "Iterator", [
            { serviceId: "map", instanceId: "m1" },
          ])}
          findServiceUI={findServiceUI}
        />
      </NestedNavProvider>,
    );

    // Folded to start with: the pipeline is reachable, not in the way.
    expect(screen.queryByText("panel:m1")).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Nested pipeline" }),
    ).toBeNull();

    fireEvent.click(openButton("Iterator"));

    expect(trail().getByText("Board")).toBeTruthy();
    expect(trail().getByText("Iterator")).toBeTruthy();
    expect(screen.getByText("panel:m1")).toBeTruthy();
  });

  it("walks back out when a crumb is clicked", () => {
    render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI
          service={host("h1", "Iterator", [
            { serviceId: "map", instanceId: "m1" },
          ])}
          findServiceUI={findServiceUI}
        />
      </NestedNavProvider>,
    );

    fireEvent.click(openButton("Iterator"));
    fireEvent.click(trail().getByText("Board"));

    expect(
      screen.queryByRole("navigation", { name: "Nested pipeline" }),
    ).toBeNull();
    expect(screen.queryByText("panel:m1")).toBeNull();
  });

  it("replaces the level when another pipeline at the same depth is opened", () => {
    render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI
          service={host("h1", "Iterator", [
            { serviceId: "map", instanceId: "m1" },
          ])}
          findServiceUI={findServiceUI}
        />
        <SubServicePipelineUI
          service={host("h2", "Switch · case 0", [
            { serviceId: "map", instanceId: "m2" },
          ])}
          findServiceUI={findServiceUI}
        />
      </NestedNavProvider>,
    );

    fireEvent.click(openButton("Iterator"));
    fireEvent.click(openButton("Switch · case 0"));

    // One level deep, showing the second pipeline — not two levels.
    expect(trail().queryByText("Iterator")).toBeNull();
    expect(trail().getByText("Switch · case 0")).toBeTruthy();
    expect(screen.getByText("panel:m2")).toBeTruthy();
    expect(screen.queryByText("panel:m1")).toBeNull();
  });

  it("closes the level when the host that opened it goes away", () => {
    const service = host("h1", "Iterator", [
      { serviceId: "map", instanceId: "m1" },
    ]);

    const { rerender } = render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI service={service} findServiceUI={findServiceUI} />
      </NestedNavProvider>,
    );

    fireEvent.click(openButton("Iterator"));
    expect(trail().getByText("Iterator")).toBeTruthy();

    // The service is removed from its runtime, so its panel unmounts.
    rerender(<NestedNavProvider rootLabel="Board">{null}</NestedNavProvider>);

    expect(
      screen.queryByRole("navigation", { name: "Nested pipeline" }),
    ).toBeNull();
  });

  it("marks the gap when a level is opened from inside inline content", () => {
    // A host whose own pipeline holds another host: expanding the outer one
    // inline puts a pipeline between the board and whatever is opened from it,
    // and that pipeline has no level of its own to name or go back to.
    const inner = host("inner", "Join", [
      { serviceId: "map", instanceId: "m2" },
    ]);
    const InnerHostUI = () => (
      <SubServicePipelineUI service={inner} findServiceUI={findServiceUI} />
    );

    render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI
          service={host("outer", "Iterator", [
            { serviceId: "sub-service", instanceId: "i1" },
          ])}
          findServiceUI={() => InnerHostUI as any}
        />
      </NestedNavProvider>,
    );

    fireEvent.click(screen.getByTitle("Show content inline"));
    fireEvent.click(openButton("Join"));

    expect(trail().getByText("Join")).toBeTruthy();
    expect(trail().getByText("…")).toBeTruthy();
  });

  it("leaves the gap unmarked when a level is opened directly", () => {
    render(
      <NestedNavProvider rootLabel="Board">
        <SubServicePipelineUI
          service={host("h1", "Iterator", [
            { serviceId: "map", instanceId: "m1" },
          ])}
          findServiceUI={findServiceUI}
        />
      </NestedNavProvider>,
    );

    fireEvent.click(openButton("Iterator"));

    expect(trail().queryByText("…")).toBeNull();
  });

  it("offers nothing to open where there is nowhere to open it", () => {
    // An embedded board or a facade renders panels without the provider.
    render(
      <SubServicePipelineUI
        service={host("h1", "Iterator", [
          { serviceId: "map", instanceId: "m1" },
        ])}
        findServiceUI={findServiceUI}
      />,
    );

    expect(screen.queryByTitle("Open Iterator as its own level")).toBeNull();
  });

  it("stays out of the mobile host, which drills down its own way", () => {
    const { container } = render(
      <MobileHostContext.Provider value={true}>
        <NestedNavProvider rootLabel="Board">
          <SubServicePipelineUI
            service={host("h1", "Iterator", [
              { serviceId: "map", instanceId: "m1" },
            ])}
            findServiceUI={findServiceUI}
          />
        </NestedNavProvider>
      </MobileHostContext.Provider>,
    );

    expect(screen.queryByTitle("Open Iterator as its own level")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
