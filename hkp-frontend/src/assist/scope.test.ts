import { describe, expect, it } from "vitest";
import {
  assistContext,
  resolveAssistProposal,
  resolveAssistScope,
} from "./scope";
import { BoardDescriptor } from "../types";

const board = {
  boardName: "Two runtimes",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "node", name: "Node", type: "rest", remote: "node" },
  ],
  services: {
    ui: [
      {
        uuid: "page",
        serviceId: "http-server",
        serviceName: "Page",
        state: { page: "hkp-asset://page" },
      },
    ],
    node: [
      {
        uuid: "mail",
        serviceId: "smtp",
        serviceName: "Mail",
        state: { password: "{{secret.smtp}}" },
      },
    ],
  },
  assets: [
    { id: "page", mediaType: "text/html", text: "<h1>Hi</h1>" },
    { id: "logo", mediaType: "image/png", base64: "AAAA" },
    { id: "remote", mediaType: "text/plain", url: "https://example.com/a" },
  ],
  facade: { panels: [{ id: "p", layout: { type: "text", serviceUuid: "page" } }] },
} as unknown as BoardDescriptor;

const options = {
  includeAssetContents: false,
  units: [],
  selectedServiceUuids: [],
  openNestedPipeline: [],
  availableRuntimeEngines: [],
  serviceCatalog: {},
};

describe("Board Assist scope", () => {
  it("edits one runtime only when one of the root board's is selected", () => {
    expect(resolveAssistScope(board, "selection", "node")).toEqual({
      kind: "runtime",
      runtimeId: "node",
      runtimeName: "Node",
    });
    expect(resolveAssistScope(board, "board", "node")).toEqual({
      kind: "board",
    });
    expect(resolveAssistScope(board, "selection", null)).toEqual({
      kind: "board",
    });
    // Contributed by an imported unit: not editable through the root board.
    expect(resolveAssistScope(board, "selection", "helper/ui")).toEqual({
      kind: "board",
    });
  });

  it("sends a runtime in full and the rest of the board as an outline", () => {
    const context = assistContext(
      board,
      { kind: "runtime", runtimeId: "ui", runtimeName: "Browser" },
      options,
    );
    expect(context.editableServices).toEqual(board.services.ui);
    expect(context.board).toBeUndefined();
    expect(JSON.stringify(context)).not.toContain("{{secret.smtp}}");
    expect(context.boardOutline).toMatchObject({
      runtimes: [
        { id: "ui", services: [{ uuid: "page", serviceId: "http-server" }] },
        { id: "node", remote: "node", services: [{ uuid: "mail" }] },
      ],
      facadeServiceUuids: ["page"],
    });
    expect(context.referencedAssets).toEqual([
      { id: "page", mediaType: "text/html", contentOmitted: true },
    ]);
  });

  it("describes runtime servers by name, never by address", () => {
    const context = assistContext(
      board,
      { kind: "board" },
      {
        ...options,
        availableRuntimeEngines: [
          { type: "browser", name: "Browser" },
          { type: "rest", name: "Laptop", url: "http://10.0.0.5:8080", aliases: ["node"] },
          { type: "rest", name: "meander-cpp", url: "hkp://remotes/meander-cpp" },
        ],
      },
    );
    expect(context.runtimeServers).toEqual([
      { type: "browser", name: "Browser" },
      { type: "rest", remote: "node", aliases: ["node"] },
      { type: "rest", remote: "embedded" },
    ]);
    expect(JSON.stringify(context)).not.toContain("10.0.0.5");
  });

  it("leaves asset contents out unless asked to include them", () => {
    const omitted = assistContext(board, { kind: "board" }, options);
    expect((omitted.board as BoardDescriptor).assets).toEqual([
      { id: "page", mediaType: "text/html", contentOmitted: true },
      { id: "logo", mediaType: "image/png", contentOmitted: true },
      board.assets![2],
    ]);
    const included = assistContext(
      board,
      { kind: "board" },
      { ...options, includeAssetContents: true },
    );
    expect((included.board as BoardDescriptor).assets).toEqual(board.assets);
  });

  it("merges a runtime proposal and leaves the rest of the board as it was", () => {
    const services = [{ uuid: "page", serviceId: "http-server", state: {} }];
    const merged = resolveAssistProposal(
      { kind: "runtime", runtimeId: "ui", runtimeName: "Browser" },
      board,
      { runtime: { ...board.runtimes[0], name: "Pages" }, services },
    );
    expect(merged.runtimes[0].name).toBe("Pages");
    expect(merged.services.ui).toEqual(services);
    expect(merged.services.node).toBe(board.services.node);
    expect(merged.runtimes[1]).toBe(board.runtimes[1]);
    expect(merged.facade).toBe(board.facade);
    expect(merged.assets).toBe(board.assets);
  });

  it("refuses a runtime proposal that renames the runtime's id", () => {
    expect(() =>
      resolveAssistProposal(
        { kind: "runtime", runtimeId: "ui", runtimeName: "Browser" },
        board,
        { runtime: { ...board.runtimes[0], id: "other" }, services: [] },
      ),
    ).toThrow("keep its id");
  });

  it("restores asset contents the model was not shown", () => {
    const proposed = resolveAssistProposal({ kind: "board" }, board, {
      ...board,
      assets: [
        { id: "page", mediaType: "text/html", contentOmitted: true },
        { id: "logo", mediaType: "image/png", text: "rewritten" },
      ],
    });
    expect(proposed.assets).toEqual([
      board.assets![0],
      { id: "logo", mediaType: "image/png", text: "rewritten" },
    ]);
    const { assets: _assets, ...withoutAssets } = board;
    expect(
      resolveAssistProposal({ kind: "board" }, board, withoutAssets).assets,
    ).toBe(board.assets);
  });
});
