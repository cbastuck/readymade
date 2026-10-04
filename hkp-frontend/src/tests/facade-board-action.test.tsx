import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ButtonRenderer } from "../facade/panels/renderers/ButtonRenderer";
import {
  FacadeBoardActionsContext,
  FacadeBoardActionsProvider,
} from "../facade/FacadeBoardActions";

/**
 * A board action names no service, so nothing in `boardServices` can carry it.
 * What it reaches instead is the host showing the facade — and a host that
 * provides none must leave the button inert rather than throwing, since the
 * same board is rendered by hosts that cannot open a window at all.
 */

vi.mock("../facade/boardServices", () => ({
  findService: () => undefined,
  processService: () => {},
}));

// The QR itself paints to a canvas, which jsdom does not implement; what this
// test is about is the link the dialog is handed.
vi.mock("../components/QR", () => ({
  default: ({ url }: { url: string }) => <canvas data-url={url} />,
}));

const partnerBoardLink = vi.fn();
vi.mock("../core/partnerBoard", () => ({
  createPartnerBoardLink: (...args: unknown[]) => partnerBoardLink(...args),
  hasPeerService: () => true,
}));

const widget = {
  type: "button" as const,
  label: "Invite partner",
  actions: [{ type: "board" as const, action: "partner-board-qr" as const }],
};

const boardContext = { scopes: {}, services: {}, runtimes: [] } as any;

function button() {
  return (
    <ButtonRenderer
      widget={widget}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />
  );
}

describe("board widget actions", () => {
  it("asks the host for the partner board QR", () => {
    const showPartnerBoardQr = vi.fn();
    render(
      <FacadeBoardActionsContext.Provider value={{ showPartnerBoardQr }}>
        {button()}
      </FacadeBoardActionsContext.Provider>,
    );
    fireEvent.click(screen.getByText("Invite partner"));
    expect(showPartnerBoardQr).toHaveBeenCalledOnce();
  });

  it("looks the same after the pointer has been and gone", () => {
    // The hover and press states set the fill and the border colour, and take
    // them away again; what is left must be the button's own.
    render(button());
    const element = screen.getByText("Invite partner");

    // jsdom has no PointerEvent, so the pointer type — which is what tells a
    // hovering mouse from a tap — has to be put on the event by hand.
    const over = createEvent.pointerOver(element);
    Object.defineProperty(over, "pointerType", { value: "mouse" });
    fireEvent(element, over);
    expect(element.style.backgroundColor).toBe("hsl(var(--muted))");

    fireEvent.pointerDown(element);
    fireEvent.pointerLeave(element);
    expect(element.style.backgroundColor).toBe("hsl(var(--card))");
    expect(element.style.borderColor).toBe("hsl(var(--border))");
  });

  it("does nothing on a host that provides no board actions", () => {
    render(button());
    expect(() =>
      fireEvent.click(screen.getByText("Invite partner")),
    ).not.toThrow();
  });

  it("opens the QR dialog with the partner board's link", async () => {
    partnerBoardLink.mockResolvedValue(
      "https://example.com/playground/x?fromLink=abc",
    );
    render(
      <FacadeBoardActionsProvider boardContext={boardContext}>
        {button()}
      </FacadeBoardActionsProvider>,
    );
    expect(screen.queryByText(/fromLink/)).toBeNull();

    fireEvent.click(screen.getByText("Invite partner"));

    await waitFor(() => {
      expect(partnerBoardLink).toHaveBeenCalledWith(boardContext);
      expect(screen.getByText(/fromLink=abc/)).toBeTruthy();
    });
  });
});
