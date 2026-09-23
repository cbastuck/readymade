import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import HoldUI from "../ui/HoldUI";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

/**
 * A Hold on another runtime, in whichever arrangement it is using.
 *
 * The two are alternatives — a property the producer carries, or a slot with a
 * role declared at each end — and the service reports only the one it is
 * using. So the panel has to read what it was given rather than draw both:
 * a Property field on a slotted Hold would sit empty, and typing in it would
 * move the service to the other arrangement without saying so.
 */

function holdProps(state: Record<string, unknown>) {
  const configure = vi.fn().mockResolvedValue(undefined);
  const service = {
    uuid: "serve-list",
    serviceId: "hold",
    serviceName: "Serve the document",
    board: "RSS Aggregator",
    state,
    configure,
    getConfiguration: async () => state,
    process: async () => {},
    destroy: async () => {},
    app: {
      listAvailableServices: () => [],
      registerNotificationTarget: () => () => {},
    },
  } as unknown as ServiceInstance;
  return { props: { service } as unknown as ServiceUIProps, configure };
}

const BY_SLOT = {
  slot: "document",
  op: "read",
  held: null,
  readCount: 3,
  writeCount: 0,
};

const BY_PROPERTY = {
  property: "triggerCount",
  held: 4,
  readCount: 1,
  writeCount: 1,
};

describe("a Hold on a REST runtime", () => {
  it("shows the slot, and no property field, when the role is declared", async () => {
    const { props } = holdProps(BY_SLOT);
    render(<HoldUI {...props} />);

    expect(await screen.findByDisplayValue("document")).toBeTruthy();
    expect(screen.queryByLabelText("Property")).toBeNull();
    expect(screen.queryByDisplayValue("triggerCount")).toBeNull();
  });

  it("shows the property, and no slot field, when the value discriminates", async () => {
    const { props } = holdProps(BY_PROPERTY);
    render(<HoldUI {...props} />);

    expect(await screen.findByDisplayValue("triggerCount")).toBeTruthy();
    expect(screen.queryByLabelText("Slot")).toBeNull();
  });

  it("says which end of the slot this one is", async () => {
    // Both ends are Holds naming one slot; which end this is is the only thing
    // distinguishing them, so it has to be on screen.
    const { props } = holdProps({ ...BY_SLOT, op: "write" });
    render(<HoldUI {...props} />);

    expect(await screen.findByText("write")).toBeTruthy();
  });

  it("reports how often each side has called", async () => {
    const { props } = holdProps(BY_SLOT);
    render(<HoldUI {...props} />);

    // A producer that has stopped writing shows up as reads without writes.
    expect(await screen.findByText("reads: 3 · writes: 0")).toBeTruthy();
  });
});
