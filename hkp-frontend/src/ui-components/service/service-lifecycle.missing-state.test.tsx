import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { useServiceLifecycle } from "./ServiceUI";

/**
 * A service that reports no state.
 *
 * Panels treat what they are handed as their state and read straight into it
 * (`state.message`), so handing them nothing throws — inside an effect's async
 * callback, where no component can catch it, taking down the page rather than
 * the panel. A board that is not running is the ordinary way to get here: it
 * still renders its services, and none of them has any state to report.
 */

function serviceReporting(config: unknown) {
  return {
    uuid: "svc-1",
    app: {
      registerNotificationTarget: vi.fn(),
      unregisterNotificationTarget: vi.fn(),
    },
    getConfiguration: vi.fn(async () => config),
  } as any;
}

function renderWith(service: any, handlers: Record<string, unknown>) {
  function Test() {
    useServiceLifecycle(service, handlers);
    return null;
  }
  return render(<Test />);
}

describe("initialising a panel", () => {
  it("hands over an empty state when the service reports none", async () => {
    const onInit = vi.fn();

    renderWith(serviceReporting(undefined), { onInit });

    await waitFor(() => expect(onInit).toHaveBeenCalledWith({}));
  });

  it("hands over what the service reports when there is some", async () => {
    const onInit = vi.fn();

    renderWith(serviceReporting({ message: "hello" }), { onInit });

    await waitFor(() =>
      expect(onInit).toHaveBeenCalledWith({ message: "hello" }),
    );
  });

  it("falls back to the notification handler with the same guarantee", async () => {
    const onNotification = vi.fn();

    renderWith(serviceReporting(null), { onNotification });

    await waitFor(() => expect(onNotification).toHaveBeenCalledWith({}));
  });

  it("keeps a panel that throws from taking the page with it", async () => {
    // Unhandled here means an unhandled rejection: notify() runs from an
    // effect, so nothing above it is in a position to catch.
    const onInit = vi.fn(() => {
      throw new Error("panel blew up");
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason);
    };
    window.addEventListener("unhandledrejection", onRejection);

    try {
      renderWith(serviceReporting({}), { onInit });
      await waitFor(() => expect(onInit).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(rejections).toEqual([]);
      expect(errors).toHaveBeenCalled();
    } finally {
      window.removeEventListener("unhandledrejection", onRejection);
      errors.mockRestore();
    }
  });
});
