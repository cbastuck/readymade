import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ButtonRenderer } from "../facade/panels/renderers/ButtonRenderer";
import { FacadeStateContext } from "../facade/FacadeStateContext";

/**
 * Whether a widget action can read what another widget published.
 *
 * `{ "$state": "key" }` in a configure payload is resolved only when the
 * calling widget hands its facade state to `executeActions`. Forgetting to is
 * silent in the worst way: the reference object travels as-is, so the service
 * receives `{ keys: { $state: "picked" } }` — a well-formed payload naming
 * nothing — and does nothing at all, with no error anywhere.
 */

const configured: unknown[] = [];

vi.mock("../facade/findService", () => ({
  findService: () => ({
    uuid: "svc",
    configure: (config: unknown) => {
      configured.push(config);
    },
  }),
  resolvePath: (obj: any, path: string) =>
    path.split(".").reduce((cur: any, key: string) => cur?.[key], obj),
}));

function renderButton(state: Record<string, unknown>) {
  configured.length = 0;
  return render(
    <FacadeStateContext.Provider value={{ state, setState: () => {} }}>
      <ButtonRenderer
        widget={{
          type: "button",
          label: "Process selected",
          action: {
            serviceUuid: "svc",
            configure: { keys: { $state: "picked" } },
          },
        }}
        boardContext={{ scopes: {}, services: {}, runtimes: [] } as any}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeStateContext.Provider>,
  );
}

describe("a widget action reading facade state", () => {
  it("sends the value another widget published, not the reference to it", () => {
    renderButton({ picked: ["msg-0001", "msg-0002"] });

    fireEvent.click(screen.getByText("Process selected"));

    expect(configured).toEqual([{ keys: ["msg-0001", "msg-0002"] }]);
  });

  it("sends nothing selected as nothing selected", () => {
    // Rather than as a reference object, which a service would read as one
    // unnamed item and act on.
    renderButton({ picked: [] });

    fireEvent.click(screen.getByText("Process selected"));

    expect(configured).toEqual([{ keys: [] }]);
  });
});
