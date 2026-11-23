import { expect, it, vi } from "vitest";
import facadeTypes from "../facade/types.ts?raw";
import {
  declarationsOf,
  readDeclaration,
  readDocumentParts,
  splitDocumentPath,
} from "./declarations";
import { FACADE_TYPES, facadeTypePath, readDocumentation } from "./documentation";

it("reads one widget's shape, a small part of the schema, with what it names", () => {
  const knob = readDeclaration(FACADE_TYPES, "KnobWidget", facadeTypes);
  expect(knob).toMatch(/^export type KnobWidget = \{\n {2}type: "knob";/);
  expect(knob).toContain(`${FACADE_TYPES}#KnobMarker`);
  expect(knob.length).toBeLessThan(facadeTypes.length / 10);
});

it("keeps the comment above a declaration with it", () => {
  const declarations = declarationsOf(
    "export type A = string;\n\n// What B is.\n/** More. */\nexport type B = A;\n",
  );
  expect(declarations).toEqual([
    { name: "A", text: "export type A = string;" },
    { name: "B", text: "// What B is.\n/** More. */\nexport type B = A;" },
  ]);
});

it("splits every part of the schema without losing a line", () => {
  const parts = declarationsOf(facadeTypes);
  expect(parts.length).toBeGreaterThan(40);
  expect(parts.map((part) => part.text).join("\n\n").replace(/\s+/g, "")).toBe(
    facadeTypes.replace(/\s+/g, ""),
  );
});

it("names the declarations a file has when asked for one it has not", () => {
  expect(() => readDeclaration(FACADE_TYPES, "Knob", facadeTypes)).toThrow(
    /has no declaration Knob\. It has: .*KnobWidget/,
  );
});

it("reads a file once for all the parts of it asked for", async () => {
  const read = vi.fn(readDocumentation);
  const documents = await readDocumentParts(
    [`${FACADE_TYPES}#KnobWidget`, `${FACADE_TYPES}#ButtonWidget`, "docs/board-json.md"],
    read,
  );
  expect(read).toHaveBeenCalledOnce();
  expect(read).toHaveBeenCalledWith([FACADE_TYPES, "docs/board-json.md"]);
  expect(documents.map((document) => document.path)).toEqual([
    `${FACADE_TYPES}#KnobWidget`,
    `${FACADE_TYPES}#ButtonWidget`,
    "docs/board-json.md",
  ]);
  expect(documents[1].content).toMatch(/^export type ButtonWidget/m);
});

it("leaves a # alone in anything but a TypeScript path", () => {
  expect(splitDocumentPath("docs/services/timer.md#modes")).toEqual({
    file: "docs/services/timer.md#modes",
  });
});

it("finds the shape of every widget type by its tag", () => {
  for (const [tag, name] of [
    ["knob", "KnobWidget"],
    ["xy-pad", "XYPadWidget"],
    ["data-table", "DataTableWidget"],
    ["show-panel", "ShowPanelAction"],
  ])
    expect(facadeTypePath(tag)).toBe(`${FACADE_TYPES}#${name}`);
  expect(facadeTypePath("todo-list")).toBeUndefined();
});
