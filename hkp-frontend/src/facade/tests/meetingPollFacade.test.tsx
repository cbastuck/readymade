import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
 * rows below are the shape the three queries return — a date with its tally, the
 * meeting with its notice, and the list of meetings — so what is asserted here
 * is that the panels say what a person is supposed to read off them.
 */

/** What each service last said, by uuid — the facade reads these by source. */
const said: Record<string, unknown> = {
  "the-dates": {
    rows: [
      {
        id: 1,
        starts: "2026-09-18 10:00",
        yes: 2,
        mine: 1,
        label: "Fri 2026-09-18 at 10:00",
        who: "anna@example.com, ben@example.com",
        score: "2 yes - best so far",
        intent: "unvote",
        answerLabel: "Take it back",
        locked: 0,
        notYours: 0,
        dropPrompt: "Take 2026-09-18 10:00 off the poll, along with every answer given to it?",
      },
      {
        id: 2,
        starts: "2026-09-19 09:30",
        yes: 0,
        mine: 0,
        label: "Sat 2026-09-19 at 09:30",
        who: "Nobody yet",
        score: "0 yes",
        intent: "vote",
        answerLabel: "Works for me",
        locked: 0,
        notYours: 0,
        dropPrompt: "Take 2026-09-19 09:30 off the poll, along with every answer given to it?",
      },
    ],
  },
  "the-poll": {
    rows: [
      {
        name: "Sprint review",
        organiser: "you@example.com",
        closed: 0,
        dates: 2,
        people: 2,
        notice: "You called this meeting, so you put up the dates and you close the poll.",
        notYours: 0,
        closeLabel: "Close the poll",
        closeIntent: "close",
        closePrompt: "Close voting on Sprint review?",
      },
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

describe("the poll panel", () => {
  it("draws one row per date, with its tally and who gave it", () => {
    renderPanel("vote");
    expect(screen.getByText("Fri 2026-09-18 at 10:00")).toBeTruthy();
    expect(screen.getByText("2 yes - best so far")).toBeTruthy();
    expect(screen.getByText("anna@example.com, ben@example.com")).toBeTruthy();
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

  it("says which meeting is being answered, and how far along it is", () => {
    renderPanel("vote");
    expect(screen.getByText("Sprint review")).toBeTruthy();
    expect(screen.getByText("2 dates · 2 answered")).toBeTruthy();
  });
});

describe("the meeting panel", () => {
  it("says who the poll belongs to and offers closing it", () => {
    renderPanel("meeting");
    expect(
      screen.getByText(
        "You called this meeting, so you put up the dates and you close the poll.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Close the poll")).toBeTruthy();
  });

  it("lists the dates to withdraw, and the meetings to switch to", () => {
    renderPanel("meeting");
    expect(screen.getAllByText("Withdraw")).toHaveLength(2);
    expect(screen.getByText("• Sprint review")).toBeTruthy();
    expect(screen.getByText("Roadmap review")).toBeTruthy();
  });

  it("keeps no row free for a reason — it is a notice now", () => {
    renderPanel("meeting");
    expect(screen.queryByText("the poll is closed")).toBeNull();
    // Every service that writes to the poll is watched, so a refusal reaches
    // whoever caused it wherever they are on the board.
    const watched = board.facade.notices.map((n) => n.source.serviceUuid);
    expect(watched).toContain("put-up-date");
    expect(watched).toContain("say-yes");
    expect(board.facade.notices.every((n) => n.source.path === "error")).toBe(true);
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
