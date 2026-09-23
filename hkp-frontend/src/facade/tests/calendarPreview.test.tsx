import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import fs from "node:fs";

import { CalendarRenderer } from "../panels/renderers/CalendarRenderer";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { CalendarWidget } from "../types";

/**
 * Writes the calendar out as a page, so its appearance can be looked at instead
 * of reasoned about. Skipped unless CALENDAR_PREVIEW names a file to write.
 */

const notified: unknown[] = [];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: unknown) =>
    source ? notified[0] : undefined,
}));

const TAKEN: Record<string, string> = {
  "9:1": "ben@club.example",
  "13:3": "kai@club.example",
  "18:2": "lena@club.example",
};

function dayRows(youHold: { hour: number; column: number } | null) {
  const rows: Record<string, unknown>[] = [];
  for (let hour = 7; hour <= 21; hour += 1) {
    for (let column = 1; column <= 3; column += 1) {
      const taken = TAKEN[`${hour}:${column}`];
      const mine = youHold && youHold.hour === hour && youHold.column === column;
      const state = mine ? "mine" : taken ? "taken" : youHold ? "blocked" : "free";
      rows.push({
        day: "Thursday 17 September 2026",
        dayOffset: 0,
        column,
        hour,
        state,
        label: mine ? "You" : taken ? taken : "",
        prompt: "",
      });
    }
  }
  return rows;
}

const widget: CalendarWidget = {
  type: "calendar",
  source: { serviceUuid: "day-grid", path: "rows" },
  columns: ["Court 1", "Court 2", "Court 3"],
  fromHour: 7,
  toHour: 21,
  rowHeight: 32,
};

function markup(rows: unknown[]) {
  notified.length = 0;
  notified.push(rows);
  const { container } = render(
    <CalendarRenderer
      widget={widget}
      boardContext={{ scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
  return container.innerHTML;
}

const LIGHT = `
  --border: 214 20% 88%;
  --muted: 210 20% 96%;
  --muted-foreground: 215 12% 47%;
  --foreground: 210 25% 12%;
  --card: 0 0% 100%;
  --background: 0 0% 100%;
  --primary: 210 70% 32%;
  --primary-foreground: 0 0% 100%;
  --hkp-accent: #17548c;
`;

const DARK = `
  --border: 213 18% 24%;
  --muted: 213 18% 18%;
  --muted-foreground: 213 12% 62%;
  --foreground: 210 20% 92%;
  --card: 213 22% 11%;
  --background: 213 24% 8%;
  --primary: 208 70% 62%;
  --primary-foreground: 213 30% 10%;
  --hkp-accent: #6fb2ee;
`;

const OUT = process.env.CALENDAR_PREVIEW;

describe("calendar preview", () => {
  // Not an assertion about the widget — a way to look at it. Two states side by
  // side in both themes, because what went wrong the first time (an unavailable
  // hour drawn heavier than a free one) is invisible in a DOM assertion and
  // obvious in a picture.
  it.skipIf(!OUT)("writes a page to CALENDAR_PREVIEW", () => {
    const out = OUT!;

    const open = markup(dayRows(null));
    const held = markup(dayRows({ hour: 12, column: 2 }));
    // What a visitor sees before saying who they are: the query offers nothing,
    // so every hour comes back blocked.
    const anon = markup(
      dayRows(null).map((r) =>
        r.state === "free" ? { ...r, state: "blocked" } : r,
      ),
    );

    const panel = (caption: string, body: string) =>
      `<div class="panel"><div class="cap">${caption}</div>${body}</div>`;

    const theme = (name: string, tokens: string) => `
      <section class="theme" style="${tokens.replace(/\n\s*/g, " ")}">
        <h2>${name}</h2>
        <div class="row">
          ${process.env.CALENDAR_ANON ? panel("Before anyone is named &mdash; nothing on offer", anon) : ""}
          ${panel("Every free hour offers itself", open)}
          ${panel("You hold 12:00 &mdash; the rest steps back", held)}
        </div>
      </section>`;

    fs.writeFileSync(
      out,
      `<!doctype html><html><head><meta charset="utf-8"><style>
       body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
       .theme { padding:24px; background:hsl(var(--background)); color:hsl(var(--foreground)); }
       h2 { font-size:12px; text-transform:uppercase; letter-spacing:.1em; margin:0 0 16px;
            color:hsl(var(--muted-foreground)); font-weight:600; }
       .row { display:flex; gap:24px; align-items:flex-start; }
       .panel { border:1px solid hsl(var(--border)); border-radius:10px; padding:16px;
                width:360px; background:hsl(var(--card)); }
       .cap { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em;
              color:hsl(var(--muted-foreground)); margin-bottom:12px; }
       button { font-family: inherit; }
       </style></head><body>
       ${theme("Light", LIGHT)}
       ${theme("Dark", DARK)}
       </body></html>`,
    );
    expect(fs.existsSync(out)).toBe(true);
  });
});
