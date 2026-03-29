import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import { useServiceLifecycle } from "./ServiceUI";

function createMockService(uuid: string, initialConfig: Record<string, any>) {
  const targets = new Set<(n: any) => void>();

  const app = {
    registerNotificationTarget: vi.fn(
      (_service: any, target: (n: any) => void) => {
        targets.add(target);
      },
    ),
    unregisterNotificationTarget: vi.fn(
      (_service: any, target: (n: any) => void) => {
        targets.delete(target);
      },
    ),
    emit: (notification: any) => {
      for (const target of targets) {
        target(notification);
      }
    },
  };

  const service = {
    uuid,
    app,
    getConfiguration: vi.fn(async () => initialConfig),
  } as any;

  return { service, app };
}

describe("useServiceLifecycle identity binding", () => {
  it("initializes exactly once per service identity and re-initializes on service swap", async () => {
    const s1 = createMockService("svc-1", { v: 1 });
    const s2 = createMockService("svc-2", { v: 2 });

    const onInit = vi.fn();
    const onNotification = vi.fn();

    function Test({ service }: { service: any }) {
      useServiceLifecycle(service, { onInit, onNotification });
      return null;
    }

    const { rerender } = render(<Test service={s1.service} />);

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(1);
      expect(onInit).toHaveBeenLastCalledWith({ v: 1 });
    });

    rerender(<Test service={s1.service} />);

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(1);
    });

    rerender(<Test service={s2.service} />);

    await waitFor(() => {
      expect(onInit).toHaveBeenCalledTimes(2);
      expect(onInit).toHaveBeenLastCalledWith({ v: 2 });
    });

    expect(s1.app.registerNotificationTarget).toHaveBeenCalledTimes(1);
    expect(s1.app.unregisterNotificationTarget).toHaveBeenCalledTimes(1);
    expect(s2.app.registerNotificationTarget).toHaveBeenCalledTimes(1);
  });

  it("delivers notifications through latest handler without re-subscribing", async () => {
    const s1 = createMockService("svc-1", { v: 1 });

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function Test({ handlerVersion }: { handlerVersion: number }) {
      const [count] = useState(0);
      const onNotification =
        handlerVersion === 0 ? firstHandler : secondHandler;
      useServiceLifecycle(s1.service, {
        onInit: () => {
          void count;
        },
        onNotification,
      });
      return null;
    }

    const { rerender } = render(<Test handlerVersion={0} />);

    await waitFor(() => {
      expect(s1.service.getConfiguration).toHaveBeenCalledTimes(1);
    });

    act(() => {
      s1.app.emit({ step: "first" });
    });

    expect(firstHandler).toHaveBeenCalledWith({ step: "first" });
    expect(secondHandler).not.toHaveBeenCalled();

    rerender(<Test handlerVersion={1} />);

    act(() => {
      s1.app.emit({ step: "second" });
    });

    expect(secondHandler).toHaveBeenCalledWith({ step: "second" });
    expect(s1.app.registerNotificationTarget).toHaveBeenCalledTimes(1);
    expect(s1.app.unregisterNotificationTarget).toHaveBeenCalledTimes(0);
  });
});
