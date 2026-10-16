import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import board from "../../../../boards/meeting-poll-demo-board.json";
import { LayoutNode } from "../panels/LayoutNode";
import { FacadeStateContext } from "../FacadeStateContext";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * The poll's panels drawn from what its queries answer.
 *
 * Board JSON is read, never compiled, so nothing else in the suite would notice
 * a widget the facade cannot draw or a field it reads under the wrong name. The
 * rows below are the shape the queries return — a date with its tally, the
 * meeting with its notice, what only its owner may do, and the list of
 * meetings — so what is asserted here is that the panels say what a person is
 * supposed to read off them.
 */

/** What each service last said, by uuid — the facade reads these by source.
 *  Said to the board's owner, so the rows only the owner is sent are here. */
const said: Record<string, unknown> = {
  "the-dates": {
    rows: [
      {
        id: 1,
        poll: "Sprint review",
        starts: "2026-09-18 10:00",
        yes: 2,
        mine: 1,
        label: "Fri 2026-09-18 at 10:00",
        who: "you, Anna",
        score: "2 yes - best so far",
        intent: "unvote",
        answerLabel: "Take it back",
        locked: 0,
      },
      {
        id: 2,
        poll: "Sprint review",
        starts: "2026-09-19 09:30",
        yes: 0,
        mine: 0,
        label: "Sat 2026-09-19 at 09:30",
        who: "Nobody yet",
        score: "0 yes",
        intent: "vote",
        answerLabel: "Works for me",
        locked: 0,
      },
    ],
  },
  "the-poll": {
    rows: [
      {
        name: "Sprint review",
        progress: "2 dates · 2 answered",
        notice: "You called this meeting, so you put up the dates and you close the poll.",
      },
    ],
  },
  organising: {
    rows: [
      {
        name: "Sprint review",
        heading: "Organising Sprint review",
        nothingToClose: 0,
        closeLabel: "Close the poll",
        closeIntent: "close",
        closePrompt: "Close voting on Sprint review?",
        proposeLabel: "Put up a date for Sprint review",
      },
    ],
  },
  withdrawable: {
    rows: [
      { id: 1, label: "Fri 2026-09-18 at 10:00", locked: 0, dropPrompt: "Take it off?" },
      { id: 2, label: "Sat 2026-09-19 at 09:30", locked: 0, dropPrompt: "Take it off?" },
    ],
  },
  "the-meetings": {
    count: 2,
    rows: [
      { name: "Sprint review", label: "• Sprint review" },
      { name: "Roadmap review", label: "Roadmap review" },
    ],
  },
  "say-yes": { changes: 1 },
  "put-up-date": { error: "the poll is closed" },
};

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (
    _ctx: unknown,
    source: { serviceUuid: string; path?: string } | undefined,
  ) => {
    if (!source) {
      return undefined;
    }
    const value = said[source.serviceUuid];
    return source.path
      ? source.path.split(".").reduce<any>((cur, key) => cur?.[key], value)
      : value;
  },
}));

vi.mock("../boardServices", () => ({
  findService: () => null,
  processService: () => {},
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState;

function renderPanel(id: string) {
  const panel = board.facade.panels.find((p) => p.id === id)!;
  return render(
    <FacadeStateContext.Provider
      value={{ state: board.facade.state, setState: () => {} }}
    >
      <LayoutNode
        item={panel.layout as unknown as LayoutItem}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeStateContext.Provider>,
  );
}

/** Whether an element sits inside something put out of sight. */
function folded(element: HTMLElement): boolean {
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    if (el.style.display === "none") {
      return true;
    }
  }
  return false;
}

describe("the poll panel", () => {
  it("draws one row per date, with its tally and who gave it", () => {
    renderPanel("vote");
    expect(screen.getByText("Fri 2026-09-18 at 10:00")).toBeTruthy();
    expect(screen.getByText("2 yes - best so far")).toBeTruthy();
    expect(screen.getByText("you, Anna")).toBeTruthy();
    expect(screen.getByText("Sat 2026-09-19 at 09:30")).toBeTruthy();
    expect(screen.getByText("Nobody yet")).toBeTruthy();
  });

  it("offers each date the answer the query decided it should", () => {
    renderPanel("vote");
    // The same control, saying the opposite thing on the two rows: what a
    // person can do with a date is the query's to say, not the layout's.
    expect(screen.getByText("Take it back")).toBeTruthy();
    expect(screen.getByText("Works for me")).toBeTruthy();
  });

  it("says which meeting is being answered, how far along it is, and whose it is", () => {
    renderPanel("vote");
    expect(screen.getByText("2 dates · 2 answered")).toBeTruthy();
    expect(
      screen.getByText(
        "You called this meeting, so you put up the dates and you close the poll.",
      ),
    ).toBeTruthy();
  });

  it("says who is answering, and offers nobody a way to answer as somebody else", () => {
    renderPanel("vote");
    expect(screen.getByText("Answering as")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("lists the meetings to switch to above the dates, where a member answers", () => {
    renderPanel("vote");
    // Picking a meeting is part of answering, so it is not left to Organise —
    // which a member has no other reason to open.
    expect(folded(screen.getByText("Roadmap review"))).toBe(false);
    expect(screen.getByText("• Sprint review")).toBeTruthy();
    expect(
      screen.getByText("Roadmap review").compareDocumentPosition(
        screen.getByText("Works for me"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("still folds the meetings away for whoever does not need them", () => {
    renderPanel("vote");
    // Folded but there: a list mounted only on opening would have missed the
    // rows its service sent while it was folded, and open empty.
    fireEvent.click(screen.getByText("Meetings"));
    expect(folded(screen.getByText("Roadmap review"))).toBe(true);
  });
});

describe("the meeting panel", () => {
  it("offers the owner putting up dates, closing, and calling a meeting", () => {
    renderPanel("meeting");
    expect(screen.getByText("Put up a date for Sprint review")).toBeTruthy();
    expect(screen.getByText("Close the poll")).toBeTruthy();
    expect(screen.getByPlaceholderText("Call a new meeting…")).toBeTruthy();
  });

  it("says which meeting is being organised, and lists the others to pick from", () => {
    renderPanel("meeting");
    expect(screen.getByText("Organising Sprint review")).toBeTruthy();
    expect(folded(screen.getByText("Roadmap review"))).toBe(false);
  });

  it("reads top to bottom: pick or call a meeting, then its dates, then closing it", () => {
    renderPanel("meeting");
    const order = [
      screen.getByText("Roadmap review"),
      screen.getByPlaceholderText("Call a new meeting…"),
      screen.getByText("Organising Sprint review"),
      screen.getByText("Put up a date for Sprint review"),
      ...screen.getAllByText("Withdraw"),
      screen.getByText("Close the poll"),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("lists the dates to withdraw", () => {
    renderPanel("meeting");
    expect(screen.getAllByText("Withdraw")).toHaveLength(2);
  });

  it("keeps no row free for a reason — it is a notice now", () => {
    renderPanel("meeting");
    expect(screen.queryByText("the poll is closed")).toBeNull();
    // Every service that writes to the poll is watched, so a refusal reaches
    // whoever caused it wherever they are on the board.
    const watched = board.facade.notices.map((n) => n.source.serviceUuid);
    expect(watched).toContain("open-poll");
    expect(watched).toContain("put-up-date");
    expect(watched).toContain("say-yes");
    expect(board.facade.notices.every((n) => n.source.path === "error")).toBe(true);
  });
});

describe("the meeting panel, shown to a member", () => {
  it("offers nothing of the owner's, only which meeting to look at", () => {
    const owners = { organising: said.organising, withdrawable: said.withdrawable };
    said.organising = { rows: [] };
    said.withdrawable = { rows: [] };
    try {
      renderPanel("meeting");
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByText("Close the poll")).toBeNull();
      expect(screen.queryByText("Withdraw")).toBeNull();
      expect(screen.queryByText("Organising Sprint review")).toBeNull();
      expect(screen.getByText(/are the board owner's/)).toBeTruthy();
      expect(screen.getByText("Roadmap review")).toBeTruthy();
    } finally {
      Object.assign(said, owners);
    }
  });
});

describe("the poll's tabs", () => {
  it("opens on answering, with putting dates up a tab away", () => {
    const tabs = board.facade.tabs;
    expect(board.facade.defaultTab).toBe("answer");
    expect(tabs.find((t) => t.id === "answer")?.panels).toEqual(["vote"]);
    expect(tabs.find((t) => t.id === "organise")?.panels).toEqual(["meeting"]);
    // Every panel the facade declares is claimed by a tab: nothing is left
    // sitting above the bar by accident.
    const claimed = tabs.flatMap((t) => t.panels);
    expect(board.facade.panels.map((p) => p.id).sort()).toEqual(claimed.sort());
  });
});
