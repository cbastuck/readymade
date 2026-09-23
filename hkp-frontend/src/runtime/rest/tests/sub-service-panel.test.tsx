import { act } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SubServiceUI from "../ui/SubServiceUI";
import { findServiceUI } from "../UIRegistry";
import NotificationTargets from "../../NotificationsTargets";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

/**
 * A scope on a REST runtime, as its panel shows it.
 *
 * What this has to get right is that a scope reads the same wherever it runs:
 * the two things it declares are named for what they do rather than for how
 * the board spells them, and the pipeline inside is editable. The one place
 * the distance shows is the cells — they stay in the runtime holding them, so
 * the panel must not claim the scope is holding nothing.
 */

// The controls are Radix selects, which read pointer capture and scroll the
// option they open on into view — neither of which jsdom implements.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false) as any;
  Element.prototype.releasePointerCapture = vi.fn() as any;
  Element.prototype.setPointerCapture = vi.fn() as any;
  Element.prototype.scrollIntoView = vi.fn() as any;
});

const STATE = {
  bypass: false,
  stopPropagation: true,
  scope: { slots: "inherit" },
  pipeline: [
    {
      serviceId: "hold",
      instanceId: "keep-it",
      state: { slot: "document", op: "write", readCount: 0, writeCount: 2 },
    },
  ],
};

function scopeProps(state: any = STATE) {
  const notifications = new NotificationTargets();
  const configure = vi.fn().mockResolvedValue(undefined);
  const service = {
    uuid: "the-scope",
    serviceId: "sub-service",
    serviceName: "SubService",
    board: "Feed",
    capabilities: ["subservices"],
    state,
    configure,
    getConfiguration: async () => state,
    process: async () => {},
    destroy: async () => {},
    app: {
      listAvailableServices: () => [{ serviceId: "hold", serviceName: "Hold" }],
      registerNotificationTarget: (svc: ServiceInstance, cb: any) =>
        notifications.register(svc, cb),
      unregisterNotificationTarget: (svc: ServiceInstance, cb: any) =>
        notifications.unregister(svc, cb),
    },
  } as unknown as ServiceInstance;
  return {
    props: { service } as unknown as ServiceUIProps,
    configure,
    notifications,
  };
}

describe("a scope's panel on a REST runtime", () => {
  it("is the one a scope has, not the generic property editor", () => {
    // The generic editor drew these as their spelling in the board: a switch
    // reading `stopPropagation`, and a text field to type "inherit" into.
    const { props } = scopeProps();
    render(<SubServiceUI {...props} />);

    expect(screen.getByText("Output")).toBeTruthy();
    expect(screen.getByText("Slots")).toBeTruthy();
    expect(screen.queryByText("stopPropagation")).toBeNull();
    expect(screen.queryByText("scope.slots")).toBeNull();
  });

  it("says what the scope declares in the words the panel uses for it", () => {
    const { props } = scopeProps();
    render(<SubServiceUI {...props} />);

    expect(screen.getByText("stops")).toBeTruthy();
    expect(screen.getByText("inherit")).toBeTruthy();
  });

  it("reports the origin without claiming the scope holds nothing", () => {
    // The cells are in the runtime running the scope and nothing carries them
    // here, so there is no count and no fold — an empty section would read as
    // a scope holding nothing, which is a different thing from not knowing.
    const { props } = scopeProps();
    render(<SubServiceUI {...props} />);

    expect(screen.queryByText("· 0")).toBeNull();
    expect(screen.queryByText("nothing held")).toBeNull();
  });

  it("shows what a later report changed", () => {
    const { props, notifications } = scopeProps();
    render(<SubServiceUI {...props} />);

    expect(screen.getByText("stops")).toBeTruthy();

    act(() => {
      notifications.notify({ uuid: "the-scope" }, { stopPropagation: false });
    });

    expect(screen.getByText("continues")).toBeTruthy();
  });

  it("edits the scope in the words the board is written in", async () => {
    const { props, configure } = scopeProps();
    render(<SubServiceUI {...props} />);

    // Output first, Slots second: the two the panel draws, in that order.
    const output = screen.getAllByRole("combobox")[0];
    fireEvent.keyDown(output, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "continues" }));

    expect(configure).toHaveBeenCalledWith({ stopPropagation: false });
  });

  it("draws the nested pipeline with the panels its services have", async () => {
    const { props } = scopeProps();
    render(<SubServiceUI {...props} />);

    fireEvent.click(screen.getByLabelText("Show content inline"));

    expect(await screen.findByText("reads: 0 · writes: 2")).toBeTruthy();
  });

  it("is the same panel for a scope its runtime says nothing about", () => {
    // A runtime that reports neither declaration still gets the controls, so
    // a board can put them there; the defaults are the ones a scope has.
    const { props } = scopeProps({ bypass: false, pipeline: [] });
    render(<SubServiceUI {...props} />);

    expect(screen.getByText("continues")).toBeTruthy();
    expect(screen.getByText("own")).toBeTruthy();
  });

  it("is what the registry hands out for a sub-service", () => {
    expect(findServiceUI("sub-service")).toBe(SubServiceUI);
  });
});
