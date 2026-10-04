import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { useNotificationValue } from "../panels/renderers/StatusIndicatorRenderer";

describe("facade service notification timing", () => {
  it("subscribes before a parent facade init effect can report its result", async () => {
    const listeners = new Set<(payload: unknown) => void>();
    const app = {
      registerNotificationTarget: (
        _service: unknown,
        listener: (payload: unknown) => void,
      ) => listeners.add(listener),
      unregisterNotificationTarget: (
        _service: unknown,
        listener: (payload: unknown) => void,
      ) => listeners.delete(listener),
      notify: (_service: unknown, payload: unknown) => {
        for (const listener of listeners) {
          listener(payload);
        }
      },
    };
    const service = { uuid: "history", app, state: {} };
    const boardContext = {
      scopes: {
        browser: {
          findServiceInstance: (uuid: string) =>
            uuid === service.uuid ? [service] : [],
        },
      },
      services: {},
      runtimes: [],
    } as unknown as BoardContextState;

    function FacadeWithInit() {
      const value = useNotificationValue(boardContext, {
        serviceUuid: "history",
        path: "rows",
      });

      useEffect(() => {
        app.notify(service, { rows: [{ value: 118 }] });
      }, []);

      return <output>{JSON.stringify(value)}</output>;
    }

    render(<FacadeWithInit />);

    await waitFor(() => {
      expect(screen.getByText('[{"value":118}]')).toBeTruthy();
    });
  });

  it("keeps one subscription to a remote service however often it redraws", () => {
    const listeners = new Set<(payload: unknown) => void>();
    const register = vi.fn(
      (_service: unknown, listener: (payload: unknown) => void) => {
        listeners.add(listener);
      },
    );
    const unregister = vi.fn(
      (_service: unknown, listener: (payload: unknown) => void) => {
        listeners.delete(listener);
      },
    );
    // A service on a remote runtime has no instance in this process: what a
    // widget subscribes on is a stand-in, and every notification redraws the
    // widget that asked for it.
    const boardContext = {
      runtimes: [
        { id: "node", name: "Node", type: "rest", url: "http://127.0.0.1:8080" },
      ],
      services: {
        node: [{ uuid: "history", serviceId: "sql", serviceName: "SQL", state: {} }],
      },
      scopes: {
        node: {
          app: {
            registerNotificationTarget: register,
            unregisterNotificationTarget: unregister,
          },
        },
      },
      registry: { node: [] },
      runtimeApis: { rest: { configureService: vi.fn() } },
    } as unknown as BoardContextState;

    function Rows() {
      const value = useNotificationValue(boardContext, {
        serviceUuid: "history",
        path: "rows",
      });
      return <output>{JSON.stringify(value)}</output>;
    }

    render(<Rows />);
    for (const count of [1, 2, 3]) {
      act(() => {
        for (const listener of listeners) {
          listener({ rows: [{ value: count }] });
        }
      });
    }

    expect(screen.getByText('[{"value":3}]')).toBeTruthy();
    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();
  });
});
