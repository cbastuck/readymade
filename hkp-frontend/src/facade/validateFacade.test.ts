import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { facadeProblems } from "./validateFacade";
// @ts-expect-error — a plain ESM script, not part of the typed sources
import { facadeSchema, serialize } from "../../scripts/facade-schema.mjs";

const boards = join(__dirname, "../../../boards");
const panel = (layout: unknown) => ({
  layout: "single",
  panels: [{ id: "main", title: "Todo", layout }],
});

describe("facade schema", () => {
  it("is what types.ts says — run `npm run facade-schema` after changing it", () => {
    const written = readFileSync(join(__dirname, "facade.schema.json"), "utf8");
    expect(written).toBe(serialize(facadeSchema(join(__dirname, "types.ts"))));
  }, 30_000);

  it("accepts the facade of every board the repository ships", () => {
    const failing = readdirSync(boards)
      .filter((file) => file.endsWith(".json"))
      .flatMap((file) => {
        const board = JSON.parse(readFileSync(join(boards, file), "utf8"));
        return board.facade
          ? facadeProblems(board.facade).map((problem) => `${file}: ${problem}`)
          : [];
      });
    expect(failing).toEqual([]);
  });

  it("says which column of which widget is wrong, and what it should be", () => {
    const facade = panel({
      direction: "column",
      items: [
        { type: "text-input", action: { serviceUuid: "add", configure: { add: "$$input" } } },
        {
          type: "data-table",
          source: { serviceUuid: "todos" },
          columns: [{ key: "title", label: "Task" }, "done"],
        },
      ],
    });
    expect(facadeProblems(facade)).toEqual([
      "facade.panels[0].layout.items[1] (data-table).columns[0]: must be string, not object.",
    ]);
  });

  it("names the widget types there are when one is not", () => {
    const [problem] = facadeProblems(panel({ type: "todo-list", source: { serviceUuid: "x" } }));
    expect(problem).toMatch(/^facade\.panels\[0\]\.layout: unknown type "todo-list"\. Known: .*"data-table"/);
  });

  it("names the properties a widget has when it is given one it has not", () => {
    const [problem] = facadeProblems(
      panel({ type: "data-table", source: { serviceUuid: "x" }, empty: "None" }),
    );
    expect(problem).toMatch(/\(data-table\)\.empty: is not a property here\. Known: .*columns/);
  });

  it("asks for what a widget needs", () => {
    expect(facadeProblems(panel({ type: "data-table" }))).toEqual([
      'facade.panels[0].layout (data-table): needs "source".',
    ]);
  });

  it("lets a repeat's item stand for a whole value in its template, and only there", () => {
    const button = { type: "button", label: "Done", disabled: "{{item.done}}" };
    expect(
      facadeProblems(panel({ type: "repeat", source: { serviceUuid: "todos" }, template: button })),
    ).toEqual([]);
    expect(facadeProblems(panel(button))).toEqual([
      'facade.panels[0].layout (button).disabled: must be boolean, not string ("{{item.done}}").',
    ]);
  });
});

