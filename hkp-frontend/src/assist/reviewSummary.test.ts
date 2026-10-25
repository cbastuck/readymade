import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BoardDescriptor } from "../types";
import { blockUse, reviewSummary } from "./reviewSummary";

const read = (name: string) =>
  JSON.parse(
    readFileSync(path.resolve(__dirname, "../../../boards", name), "utf8"),
  ) as BoardDescriptor;

const court = read("court-booking-demo-board.json");
const poll = read("meeting-poll-demo-board.json");
const empty = { runtimes: [], services: {} } as unknown as BoardDescriptor;

describe("what a proposal asks to be reviewed", () => {
  it("separates what was written for the board from the blocks it uses", () => {
    const summary = reviewSummary(empty, court, blockUse([court, poll]));

    expect(summary.added).toEqual(["Give an hour back", "Take an hour", "The day"]);
    // The statements and schemas are what somebody wrote; the rest is chosen.
    expect(summary.authored.map((t) => `${t.service}.${t.field}`)).toEqual([
      "Give an hour back.schema",
      "Give an hour back.statement",
      "Take an hour.statement",
      "The day.schema",
      "The day.statement",
    ]);
    expect(summary.authoredLines).toBeGreaterThan(40);
    // sql is in both boards; the calendar is court booking's own.
    expect(summary.blocks).toContainEqual({ kind: "service", id: "sql", boards: 2 });
    expect(summary.blocks).toContainEqual({ kind: "widget", id: "calendar", boards: 1 });
    expect(summary.blocks).toContainEqual({ kind: "widget", id: "button", boards: 2 });
  });

  it("counts only what changed when a board is edited", () => {
    const edited = JSON.parse(JSON.stringify(court));
    edited.services.club[1].state.statement += "\n-- a comment";
    const summary = reviewSummary(court, edited);

    expect(summary.added).toEqual([]);
    expect(summary.changed).toEqual(["Take an hour"]);
    expect(summary.authored.map((t) => t.field)).toEqual(["statement"]);
  });
});
