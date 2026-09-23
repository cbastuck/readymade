import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import HttpEndpointUI from "../ui/HttpEndpointUI";
import NotificationTargets from "../../NotificationsTargets";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";

/**
 * An endpoint's panel while its runtime is running.
 *
 * Two things a live board does to it, neither of which a static render shows:
 * the service reports, and what is nested inside it reports. A report is not a
 * state read — a service says what it has to say and no more — and a nested
 * service is filed under the path through the services containing it, not
 * under the instanceId that is unique only inside its own pipeline.
 */

const STATE = {
  bypass: false,
  mountName: "list",
  __hkpMount: "http://127.0.0.1:8080/hosted/83ce3edd",
  onProcess: [
    {
      serviceId: "hold",
      instanceId: "keep-list",
      state: { slot: "document", op: "write", readCount: 0, writeCount: 2 },
    },
  ],
  onRequest: [
    {
      serviceId: "hold",
      instanceId: "serve-list",
      state: { slot: "document", op: "read", readCount: 0, writeCount: 0 },
    },
  ],
};

/** The endpoint as a panel sees it, nested inside a sub-service of its own. */
function endpointProps(address?: string) {
  const notifications = new NotificationTargets();
  const service = {
    uuid: "feed-serve",
    address,
    serviceId: "http-server-subservices",
    serviceName: "Serve the feed",
    board: "RSS Aggregator",
    state: STATE,
    configure: vi.fn().mockResolvedValue(undefined),
    getConfiguration: async () => STATE,
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
  return { props: { service } as unknown as ServiceUIProps, notifications };
}

describe("the HTTP endpoint's panel", () => {
  it("keeps its pipelines when the service reports only its address", async () => {
    // What a mount claim reports, and all it reports. Read as a whole state it
    // would empty the panel of everything but the address — which is what a
    // reader saw: a panel that had been showing both pipelines lost them the
    // moment its runtime published where the endpoint answers.
    const { props, notifications } = endpointProps("list.feed-serve");
    render(<HttpEndpointUI {...props} />);

    expect(await screen.findByText("onRequest")).toBeTruthy();

    act(() => {
      notifications.notify(
        { uuid: "list.feed-serve" },
        { __hkpMount: "http://127.0.0.1:8080/hosted/other" },
      );
    });

    expect(screen.getByText("onRequest")).toBeTruthy();
    expect(screen.getByText("onProcess")).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:8080/hosted/other")).toBeTruthy();
  });

  it("listens for a nested service where its runtime reports it", async () => {
    // The runtime files a service inside a pipeline under the path through the
    // services containing it: the endpoint's own address, then the instanceId.
    // The pipeline's name is not part of it — a pipeline is not a service.
    const { props, notifications } = endpointProps("list.feed-serve");
    render(<HttpEndpointUI {...props} />);

    expect(await screen.findByText("reads: 0 · writes: 0")).toBeTruthy();

    act(() => {
      notifications.notify(
        { uuid: "list.feed-serve.serve-list" },
        { slot: "document", op: "read", readCount: 4, writeCount: 0 },
      );
    });

    expect(await screen.findByText("reads: 4 · writes: 0")).toBeTruthy();
  });

  it("falls back to the uuid for an endpoint that is not itself nested", async () => {
    const { props, notifications } = endpointProps();
    render(<HttpEndpointUI {...props} />);

    expect(await screen.findByText("reads: 0 · writes: 0")).toBeTruthy();

    act(() => {
      notifications.notify(
        { uuid: "feed-serve.serve-list" },
        { slot: "document", op: "read", readCount: 7, writeCount: 0 },
      );
    });

    expect(await screen.findByText("reads: 7 · writes: 0")).toBeTruthy();
  });
});
