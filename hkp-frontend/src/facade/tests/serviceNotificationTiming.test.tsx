import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
