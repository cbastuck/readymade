import { describe, expect, it } from "vitest";
import { validateAssistBoard } from "./validation";
const valid = () => ({
  boardName: "Camera",
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: {
    ui: [
      {
        uuid: "timer",
        serviceId: "hookup.to/service/timer",
        state: { interval: 60000 },
      },
    ],
  },
});
describe("assistant board validation", () => {
  it("accepts complete board state without dropping assets or facade", () => {
    const board = {
      ...valid(),
      assets: [{ id: "message", text: "hello" }],
      facade: { layout: "single", panels: [] },
    };
    expect(validateAssistBoard(board)).toBe(board);
  });
  it.each([
    null,
    {},
    { ...valid(), runtimes: [{ id: "x", name: "X", type: "python" }] },
    { ...valid(), services: { unknown: [] } },
    { ...valid(), services: { ui: [{ uuid: "x", state: {} }] } },
  ])("rejects invalid board %j", (board) =>
    expect(() => validateAssistBoard(board)).toThrow(),
  );
  it("rejects duplicate runtime and service identifiers", () => {
    const board = valid();
    board.runtimes.push(board.runtimes[0]);
    expect(() => validateAssistBoard(board)).toThrow("Duplicate runtime");
    board.runtimes.pop();
    board.services.ui.push(board.services.ui[0]);
    expect(() => validateAssistBoard(board)).toThrow("unique");
  });
  it("checks nested pipeline identifiers and remote addressing", () => {
    expect(() =>
      validateAssistBoard({
        runtimes: [
          {
            id: "r",
            name: "Node",
            type: "rest",
            remote: "node",
            url: "https://example.com",
          },
        ],
        services: { r: [] },
      }),
    ).toThrow("exactly one");
    const board = valid();
    board.services.ui[0].state = {
      pipeline: [{ serviceId: "sub-service" }],
    } as any;
    expect(() => validateAssistBoard(board)).toThrow("identifiers");
  });
  it("holds a facade to its schema, saying where and what", () => {
    const table = (columns: unknown[]) => ({
      ...valid(),
      facade: {
        layout: "single",
        panels: [
          {
            id: "todos",
            layout: { type: "data-table", source: { serviceUuid: "timer" }, columns },
          },
        ],
      },
    });
    expect(() => validateAssistBoard(table([{ key: "title" }]))).toThrow(
      "The facade does not match its schema (hkp-frontend/src/facade/types.ts):\n- facade.panels[0].layout (data-table).columns[0]: must be string, not object.",
    );
    expect(() => validateAssistBoard(table(["title"]))).not.toThrow();
  });
  it("does not hold what was already there against a proposal", () => {
    const facade = (extra: object) => ({
      layout: "single",
      panels: [{ id: "main", layout: { type: "qr-code", source: { serviceUuid: "timer" }, ...extra } }],
    });
    const base = { ...valid(), facade: facade({ legacy: true }) } as any;
    const renamed = { ...base, boardName: "Renamed" };
    expect(validateAssistBoard(renamed, base)).toBe(renamed);
    expect(() =>
      validateAssistBoard({ ...base, facade: facade({ legacy: true, size: "big" }) }, base),
    ).toThrow(/\.size: is not a property here/);
  });
});

