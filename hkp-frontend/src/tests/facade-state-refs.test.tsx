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
const processed: unknown[] = [];

vi.mock("../facade/boardServices", () => ({
  findService: () => ({
    uuid: "svc",
    configure: (config: unknown) => {
      configured.push(config);
    },
  }),
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

function renderButton(state: Record<string, unknown>) {
  configured.length = 0;
  processed.length = 0;
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

function renderProcessButton(state: Record<string, unknown>) {
  configured.length = 0;
  processed.length = 0;
  return render(
    <FacadeStateContext.Provider value={{ state, setState: () => {} }}>
      <ButtonRenderer
        widget={{
          type: "button",
          label: "Process selected",
          actions: [
            {
              type: "process",
              serviceUuid: "approved",
              payload: { keys: { $state: "picked" } },
            },
          ],
        }}
        boardContext={{ scopes: {}, services: {}, runtimes: [] } as any}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeStateContext.Provider>,
  );
}

describe("asking a service to do its job", () => {
  it("sends the payload to the service, without configuring it", () => {
    // The verb a facade was missing: before this, causing work meant writing
    // into a service's configuration and hoping it read it as a command.
    renderProcessButton({ picked: ["msg-0001"] });

    fireEvent.click(screen.getByText("Process selected"));

    expect(processed).toEqual([
      { uuid: "approved", payload: { keys: ["msg-0001"] } },
    ]);
    expect(configured).toEqual([]);
  });

  it("resolves facade state in the payload the same way", () => {
    renderProcessButton({ picked: [] });

    fireEvent.click(screen.getByText("Process selected"));

    expect(processed).toEqual([{ uuid: "approved", payload: { keys: [] } }]);
  });
});

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
