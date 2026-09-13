import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { BoardContextState } from "../BoardContext";
import Runtime from "./Runtime";
import { SelectionProvider, useSelection } from "../selection/SelectionContext";
import type { RuntimeDescriptor } from "../types";

// The runtime's own body is not what is under test here — only that touching it
// tells the playground which runtime is being worked on.
vi.mock("hkp-frontend/src/ui-components/runtime-ui", () => ({
  default: ({ selected }: { selected?: boolean }) => (
    <div data-testid="runtime-ui" data-selected={String(!!selected)}>
      body
    </div>
  ),
}));

const runtime = {
  id: "node",
  name: "NodeJS 2",
  type: "rest",
  state: {},
} as unknown as RuntimeDescriptor;

const boardContext = {
  runtimes: [runtime],
  services: { node: [] },
  registry: {},
  scopes: {},
  appContext: null,
} as unknown as BoardContextState;

function SelectionReadout() {
  const selection = useSelection();
  return <div data-testid="selected">{selection?.selectedRuntimeId ?? ""}</div>;
}

function renderRuntime(withProvider = true) {
  const subject = (
    <>
      <Runtime
        boardContext={boardContext}
        initialState={{}}
        runtime={runtime}
        onResult={vi.fn()}
        processRuntimeByName={vi.fn()}
      />
      <SelectionReadout />
    </>
  );
  return render(
    withProvider ? <SelectionProvider>{subject}</SelectionProvider> : subject,
  );
}

describe("Runtime selection", () => {
  it("selects the runtime that was touched", () => {
    renderRuntime();
    expect(screen.getByTestId("runtime-ui").dataset.selected).toBe("false");

    fireEvent.pointerDown(screen.getByTestId("runtime-ui"));

    expect(screen.getByTestId("selected").textContent).toBe("node");
    expect(screen.getByTestId("runtime-ui").dataset.selected).toBe("true");
  });

  it("is inert where no selection is mounted", () => {
    renderRuntime(false);
    fireEvent.pointerDown(screen.getByTestId("runtime-ui"));
    expect(screen.getByTestId("runtime-ui").dataset.selected).toBe("false");
  });
});
