import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem, SwimlaneWidget } from "../types";
import { LayoutNode } from "../panels/LayoutNode";
import { SwimlaneDragProvider } from "../SwimlaneDragContext";
import { FacadeStateContext } from "../FacadeStateContext";

let rows = [
  { cardId: 1, laneId: "backlog", title: "First", description: "One", position: 0 },
  { cardId: 2, laneId: "backlog", title: "Second", description: "Two", position: 1 },
  { cardId: 3, laneId: "doing", title: "Active", description: "Three", position: 0 },
];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: () => rows,
}));

const processed: Array<{ uuid: string; payload: unknown }> = [];

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

const actions = (serviceUuid: string) => [
  { type: "process" as const, serviceUuid, payload: "{{item}}" },
];

function lane(
  laneId: string,
  title: string,
  extra: Partial<SwimlaneWidget> = {},
): SwimlaneWidget {
  return {
    type: "swimlane",
    laneId,
    title,
    dragGroup: "work",
    source: { serviceUuid: "read", path: "rows" },
    editActions: actions("edit"),
    deleteActions: actions("delete"),
    moveActions: actions("move"),
    ...extra,
  };
}

const layout: LayoutItem = {
  direction: "row",
  items: [
    lane("backlog", "Backlog", {
      allowCreate: true,
      createActions: actions("create"),
    }),
    lane("doing", "In progress"),
    lane("done", "Done"),
  ],
};

function show() {
  processed.length = 0;
  return render(
    <SwimlaneDragProvider>
      <LayoutNode
        item={layout}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </SwimlaneDragProvider>,
  );
}

function transfer() {
  return {
    effectAllowed: "none",
    dropEffect: "none",
    setData: vi.fn(),
    getData: vi.fn(),
  };
}

describe("composed swimlanes", () => {
  it("selects each lane's cards from one shared source and keeps an empty lane", () => {
    show();
    const backlog = screen.getByRole("region", { name: "Backlog" });
    const doing = screen.getByRole("region", { name: "In progress" });
    const done = screen.getByRole("region", { name: "Done" });

    expect(within(backlog).getByText("First")).toBeTruthy();
    expect(within(backlog).getByText("Second")).toBeTruthy();
    expect(within(backlog).queryByText("Active")).toBeNull();
    expect(within(doing).getByText("Active")).toBeTruthy();
    expect(within(done).getByText("No cards")).toBeTruthy();
  });

  it("offers creation only where the lane permits it", () => {
    show();
    expect(screen.getByRole("button", { name: "Add card to Backlog" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add card to In progress" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add card to Done" })).toBeNull();
  });

  it("creates a card with the lane's identity", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Add card to Backlog" }));
    fireEvent.change(screen.getByLabelText("Card title"), {
      target: { value: "A new card" },
    });
    fireEvent.change(screen.getByLabelText("Card description"), {
      target: { value: "Some detail" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add card" }));

    await waitFor(() =>
      expect(processed).toEqual([
        {
          uuid: "create",
          payload: {
            operation: "create",
            laneId: "backlog",
            title: "A new card",
            description: "Some detail",
          },
        },
      ]),
    );
  });

  it("edits a card without losing its identity", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
    fireEvent.change(screen.getByLabelText("Card title"), {
      target: { value: "First, revised" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(processed).toEqual([
        {
          uuid: "edit",
          payload: {
            operation: "edit",
            cardId: 1,
            laneId: "backlog",
            title: "First, revised",
            description: "One",
            card: rows[0],
          },
        },
      ]),
    );
  });

  it("uses domain wording in the shared card editor", () => {
    render(
      <SwimlaneDragProvider>
        <LayoutNode
          item={lane("backlog", "Drafts", {
            editorTitle: "Review generated email",
            titleLabel: "Subject",
            descriptionLabel: "Body",
            saveLabel: "Save draft",
          })}
          boardContext={boardContext}
          panelContext={{ knobValues: {}, onKnobChange: () => {} }}
        />
      </SwimlaneDragProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));

    expect(screen.getByText("Review generated email")).toBeTruthy();
    expect(screen.getByLabelText("Subject")).toBeTruthy();
    expect(screen.getByLabelText("Body")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeTruthy();
  });

  it("confirms a deletion before sending the card", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Delete Active" }));
    expect(screen.getByText("Delete “Active”?")).toBeTruthy();
    expect(processed).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Yes, do it" }));

    await waitFor(() =>
      expect(processed).toEqual([
        {
          uuid: "delete",
          payload: {
            operation: "delete",
            cardId: 3,
            laneId: "doing",
            title: "Active",
            description: "Three",
            card: rows[2],
          },
        },
      ]),
    );
  });

  it("moves a card into an empty independent lane", async () => {
    const { container } = show();
    const card = container.querySelector<HTMLElement>('[data-card-id="1"]')!;
    const destination = screen.getByRole("region", { name: "Done" });
    const dataTransfer = transfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });

    await waitFor(() =>
      expect(processed).toEqual([
        {
          uuid: "move",
          payload: {
            operation: "move",
            cardId: 1,
            fromLaneId: "backlog",
            toLaneId: "done",
            fromPosition: 0,
            toPosition: 0,
            card: rows[0],
          },
        },
      ]),
    );
  });

  it("separates a draggable source from a drop-only command lane", async () => {
    processed.length = 0;
    const commandLayout: LayoutItem = {
      direction: "row",
      items: [
        lane("backlog", "Review", {
          allowDrag: true,
          acceptDrops: false,
          moveActions: undefined,
        }),
        lane("done", "Approve", {
          allowDrag: false,
          acceptDrops: true,
          moveActions: actions("approve"),
        }),
      ],
    };
    const { container } = render(
      <SwimlaneDragProvider>
        <LayoutNode
          item={commandLayout}
          boardContext={boardContext}
          panelContext={{ knobValues: {}, onKnobChange: () => {} }}
        />
      </SwimlaneDragProvider>,
    );
    const card = container.querySelector<HTMLElement>('[data-card-id="1"]')!;
    const destination = screen.getByRole("region", { name: "Approve" });
    const dataTransfer = transfer();

    expect(card.getAttribute("draggable")).toBe("true");
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });

    await waitFor(() => expect(processed[0]?.uuid).toBe("approve"));
  });

  it("numbers a same-lane drop after removing the dragged card", async () => {
    const { container } = show();
    const first = container.querySelector<HTMLElement>('[data-card-id="1"]')!;
    const second = container.querySelector<HTMLElement>('[data-card-id="2"]')!;
    const backlog = screen.getByRole("region", { name: "Backlog" });
    const dataTransfer = transfer();

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(second, { dataTransfer, clientY: 10 });
    fireEvent.drop(backlog, { dataTransfer });

    await waitFor(() =>
      expect(processed[0]).toEqual({
        uuid: "move",
        payload: {
          operation: "move",
          cardId: 1,
          fromLaneId: "backlog",
          toLaneId: "backlog",
          fromPosition: 0,
          toPosition: 1,
          card: rows[0],
        },
      }),
    );
  });

  // Dragging is one way to move a card, not the only one: a keyboard has no
  // drag, and not every host a board runs in delivers one from a touch.
  describe("moving without a drag", () => {
    const openMoveMenu = (title: string) => {
      const trigger = screen.getByRole("button", { name: `Move ${title}` });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
    };

    it("sends a card to the end of another lane from the keyboard", async () => {
      show();
      openMoveMenu("First");
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Move to In progress" }),
      );

      await waitFor(() =>
        expect(processed).toEqual([
          {
            uuid: "move",
            payload: {
              operation: "move",
              cardId: 1,
              fromLaneId: "backlog",
              toLaneId: "doing",
              fromPosition: 0,
              toPosition: 1,
              card: rows[0],
            },
          },
        ]),
      );
    });

    it("moves a card one place within its lane", async () => {
      show();
      openMoveMenu("First");
      const up = await screen.findByRole("menuitem", { name: "Move up" });
      expect(up.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));

      await waitFor(() =>
        expect(processed[0]).toEqual({
          uuid: "move",
          payload: {
            operation: "move",
            cardId: 1,
            fromLaneId: "backlog",
            toLaneId: "backlog",
            fromPosition: 0,
            toPosition: 1,
            card: rows[0],
          },
        }),
      );
    });

    it("offers what a drag would allow, and nothing else", async () => {
      processed.length = 0;
      const commandLayout: LayoutItem = {
        direction: "row",
        items: [
          lane("backlog", "Review", {
            allowDrag: true,
            acceptDrops: false,
            moveActions: undefined,
          }),
          lane("doing", "Approve", {
            allowDrag: false,
            acceptDrops: true,
            moveActions: actions("approve"),
          }),
        ],
      };
      render(
        <SwimlaneDragProvider>
          <LayoutNode
            item={commandLayout}
            boardContext={boardContext}
            panelContext={{ knobValues: {}, onKnobChange: () => {} }}
          />
        </SwimlaneDragProvider>,
      );

      // A card that cannot be dragged out of its lane cannot be sent out of it.
      expect(screen.queryByRole("button", { name: "Move Active" })).toBeNull();

      openMoveMenu("First");
      const items = await screen.findAllByRole("menuitem");
      expect(items.map((item) => item.textContent)).toEqual(["Move to Approve"]);
      fireEvent.click(items[0]);

      await waitFor(() => expect(processed[0]?.uuid).toBe("approve"));
    });
  });

  // One selection for the whole board, though every lane is its own widget:
  // it is held in facade state, which is also how anything else reaches it.
  describe("selecting a card", () => {
    let published: Record<string, unknown> = {};

    function Board() {
      const [state, setStateRaw] = useState<Record<string, unknown>>({});
      published = state;
      const selectable: LayoutItem = {
        direction: "row",
        items: ["backlog", "doing"].map((laneId) =>
          lane(laneId, laneId, { selectable: true, selectionState: "picked" }),
        ),
      };
      return (
        <FacadeStateContext.Provider
          value={{
            state,
            setState: (key, value) =>
              setStateRaw((prev) => ({ ...prev, [key]: value })),
          }}
        >
          <SwimlaneDragProvider>
            <LayoutNode
              item={selectable}
              boardContext={boardContext}
              panelContext={{ knobValues: {}, onKnobChange: () => {} }}
            />
          </SwimlaneDragProvider>
        </FacadeStateContext.Provider>
      );
    }

    const card = (container: HTMLElement, id: number) =>
      container.querySelector<HTMLElement>(`[data-card-id="${id}"]`)!;
    const selectedIds = (container: HTMLElement) =>
      [...container.querySelectorAll('[aria-current="true"]')].map((el) =>
        el.getAttribute("data-card-id"),
      );

    it("holds one selection across lanes and lets go on a second click", () => {
      const { container } = render(<Board />);
      expect(selectedIds(container)).toEqual([]);

      fireEvent.click(card(container, 1));
      expect(selectedIds(container)).toEqual(["1"]);
      expect(published).toEqual({ picked: 1 });

      fireEvent.click(card(container, 3));
      expect(selectedIds(container)).toEqual(["3"]);

      fireEvent.click(card(container, 3));
      expect(selectedIds(container)).toEqual([]);
      expect(published.picked).toBeUndefined();
    });

    it("selects from the keyboard", () => {
      const { container } = render(<Board />);
      const first = card(container, 1);
      expect(first.tabIndex).toBe(0);

      fireEvent.keyDown(first, { key: "Enter" });
      expect(published).toEqual({ picked: 1 });
      fireEvent.keyDown(first, { key: " " });
      expect(published.picked).toBeUndefined();
    });

    it("leaves the selection alone when a control on the card is used", () => {
      const { container } = render(<Board />);
      fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(selectedIds(container)).toEqual([]);
    });

    it("keeps a moved card selected and drops a deleted one", () => {
      const before = rows;
      const { container, rerender } = render(<Board />);
      fireEvent.click(card(container, 1));

      act(() => {
        rows = before.map((row) =>
          row.cardId === 1 ? { ...row, laneId: "doing", position: 1 } : row,
        );
        rerender(<Board />);
      });
      expect(selectedIds(container)).toEqual(["1"]);

      act(() => {
        rows = rows.filter((row) => row.cardId !== 1);
        rerender(<Board />);
      });
      expect(published.picked).toBeUndefined();
      rows = before;
    });

    it("is not offered by a lane that does not ask for it", () => {
      const { container } = show();
      const first = card(container, 1);
      fireEvent.click(first);
      expect(first.hasAttribute("tabindex")).toBe(false);
      expect(selectedIds(container)).toEqual([]);
    });
  });

  // Where a card would land is asked of the lane, not of the card under the
  // pointer: most of a lane is not a card, and the mark must not change what is
  // under the pointer by appearing.
  describe("the drop mark", () => {
    /** Cards 40 high, 8 apart, the first one starting at 100. */
    function layOut(container: HTMLElement) {
      container
        .querySelectorAll<HTMLElement>("article[data-card-id]")
        .forEach((card) => {
          const lane = card.closest("section")!;
          const index = [...lane.querySelectorAll("article[data-card-id]")].indexOf(card);
          const top = 100 + index * 48;
          card.getBoundingClientRect = () =>
            ({ top, bottom: top + 40, height: 40, left: 0, right: 200, width: 200 }) as DOMRect;
        });
    }

    const over = (lane: HTMLElement, target: Element, clientY: number) => {
      // jsdom's drag events carry no coordinates of their own.
      const event = new Event("dragover", { bubbles: true, cancelable: true });
      Object.assign(event, { clientY, dataTransfer: transfer() });
      act(() => {
        target.dispatchEvent(event);
      });
      return [...lane.querySelectorAll("[data-testid^='drop-']")].map((mark) =>
        mark.getAttribute("data-testid"),
      );
    };

    it("answers the same in a gap, on the header and on a card", () => {
      const { container } = show();
      layOut(container);
      const backlog = screen.getByRole("region", { name: "Backlog" });
      const header = backlog.querySelector("header")!;
      const second = container.querySelector('[data-card-id="2"]')!;

      fireEvent.dragStart(container.querySelector('[data-card-id="3"]')!, {
        dataTransfer: transfer(),
      });

      // Above the first card, wherever that is.
      expect(over(backlog, header, 60)).toEqual(["drop-backlog-0"]);
      // Between the two cards, over the lane itself and over the lower card.
      expect(over(backlog, backlog, 144)).toEqual(["drop-backlog-1"]);
      expect(over(backlog, second, 150)).toEqual(["drop-backlog-1"]);
      // Past the middle of the last card, and below it.
      expect(over(backlog, second, 170)).toEqual(["drop-backlog-end"]);
      expect(over(backlog, backlog, 400)).toEqual(["drop-backlog-end"]);
    });

    it("takes no room, so the cards stay where the pointer found them", () => {
      const { container } = show();
      layOut(container);
      const backlog = screen.getByRole("region", { name: "Backlog" });

      fireEvent.dragStart(container.querySelector('[data-card-id="3"]')!, {
        dataTransfer: transfer(),
      });
      over(backlog, backlog, 144);

      const mark = backlog.querySelector<HTMLElement>("[data-testid='drop-backlog-1']")!;
      expect(mark.style.position).toBe("absolute");
    });
  });
});
