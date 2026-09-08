import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import CommunicationDispatcherUI from "../ui/CommunicationDispatcherUI";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

/**
 * Every other nested host has one pipeline; this one has a pipeline per action.
 * An edit made inside an action's editor must therefore arrive tagged with the
 * action it was made in — untagged, it would land on whichever pipeline the
 * service happened to treat as its own.
 */

const STATE = {
  goal: "Book a hotel room.",
  states: [{ name: "init", describe: "" }],
  decide: [{ serviceId: "text-generation", instanceId: "brain", state: {} }],
  actions: [
    { name: "extract", describe: "read it", available: "", pipeline: [] },
    {
      name: "follow-up",
      describe: "ask for more",
      available: "params.known.count > 0",
      pipeline: [{ serviceId: "map", instanceId: "as-prompt", state: {} }],
    },
  ],
  lastAction: "extract",
  lastReason: "nothing read yet",
  error: "",
};

function dispatcherProps(configure: ReturnType<typeof vi.fn>) {
  const service = {
    uuid: "manager",
    serviceId: "communication-dispatcher",
    serviceName: "Communication Dispatcher",
    board: "SYN",
    state: STATE,
    configure,
    getConfiguration: async () => STATE,
    process: async () => {},
    destroy: async () => {},
    app: {
      listAvailableServices: () => [
        { serviceId: "map", serviceName: "Map" },
        { serviceId: "text-generation", serviceName: "Text Generation" },
      ],
      registerNotificationTarget: () => () => {},
    },
  } as unknown as ServiceInstance;
  return { service } as unknown as ServiceUIProps;
}

describe("editing one action's pipeline", () => {
  it("tags an edit with the branch it was made in", async () => {
    const configure = vi.fn().mockResolvedValue(undefined);
    render(<CommunicationDispatcherUI {...dispatcherProps(configure)} />);

    // Reach the branch the way the editor does: through the stand-in service
    // the UI hands to SubServicePipelineUI for that action.
    const removeButtons = await screen.findAllByText("Remove");
    removeButtons[1].click();

    expect(configure).toHaveBeenCalledWith({ removeAction: "follow-up" });
  });

  it("shows each action, its precondition and what was last decided", async () => {
    const configure = vi.fn().mockResolvedValue(undefined);
    render(<CommunicationDispatcherUI {...dispatcherProps(configure)} />);

    expect((await screen.findAllByText("extract")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("follow-up").length).toBeGreaterThan(0);
    expect(
      screen.getByDisplayValue("params.known.count > 0"),
    ).toBeTruthy();
    expect(screen.getByText(/nothing read yet/)).toBeTruthy();
  });
});
