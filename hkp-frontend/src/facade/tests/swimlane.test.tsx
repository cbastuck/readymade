import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem, SwimlaneWidget } from "../types";
import { LayoutNode } from "../panels/LayoutNode";
import { SwimlaneDragProvider } from "../SwimlaneDragContext";

const rows = [
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
});
