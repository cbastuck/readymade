import { describe, expect, it, vi } from "vitest";

import {
  AssetDescriptor,
  assetSize,
  assetsOfRuntime,
  findAssetRefs,
  findAssetUses,
  formatAssetRef,
  parseAssetRef,
  readBoardAssets,
  referencedAssets,
  renameAssetRefs,
  uniqueAssetId,
  upsertAsset,
} from "../assets";
import { UnitBoard } from "../units";
import { defaultUnitOrigin, linkBoard } from "../../../core/linkUnits";
import { linkBlocks, unlinkBlocks } from "../../../core/linkBlocks";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

const page: AssetDescriptor = { id: "page", mediaType: "text/html", text: "<p>hi</p>" };
const app: AssetDescriptor = { id: "app", mediaType: "text/javascript", text: "1" };
const model: AssetDescriptor = { id: "model", mediaType: "application/octet-stream", url: "https://example.com/m.bin" };

describe("asset references", () => {
  it("are whole values", () => {
    expect(parseAssetRef("hkp-asset://page")).toBe("page");
    expect(parseAssetRef(formatAssetRef("player.js"))).toBe("player.js");
    expect(parseAssetRef("<script>hkp-asset://page</script>")).toBeNull();
    expect(parseAssetRef("hkp-asset://")).toBeNull();
    expect(parseAssetRef(undefined)).toBeNull();
  });

  it("are found anywhere a string mentions one, nested or inside an expression", () => {
    const state = {
      template: {
        "body=": "params.meta.path == '/app.js' ? 'hkp-asset://app' : 'hkp-asset://page'",
      },
      pipeline: [{ state: { asset: "hkp-asset://page" } }],
    };
    expect(findAssetRefs(state)).toEqual(["app", "page"]);
  });

  it("pick out only the descriptors a set of services references", () => {
    const services = [{ state: { body: "hkp-asset://page" } }, { state: { x: "hkp-asset://gone" } }];
    expect(referencedAssets(services, [page, app, model])).toEqual({ page });
  });
});

describe("used by", () => {
  it("names each service, its runtime and the field", () => {
    const uses = findAssetUses(
      {
        relay: [
          {
            uuid: "radio",
            serviceName: "Radio",
            state: { onRequest: [{ state: { template: { body: "hkp-asset://page" } } }] },
          },
        ],
        home: [{ uuid: "mic", state: { device: "default" } }],
      },
      "page",
    );
    expect(uses).toEqual([
      {
        runtimeId: "relay",
        serviceUuid: "radio",
        serviceName: "Radio",
        path: ["onRequest", 0, "state", "template", "body"],
        assetId: "page",
      },
    ]);
  });
});

describe("renaming", () => {
  it("rewrites whole values and mentions, and nothing that merely starts the same", () => {
    const state = {
      body: "hkp-asset://page",
      "body=": "x ? 'hkp-asset://page' : 'hkp-asset://page-2'",
    };
    expect(renameAssetRefs(state, "page", "player")).toEqual({
      body: "hkp-asset://player",
      "body=": "x ? 'hkp-asset://player' : 'hkp-asset://page-2'",
    });
  });

  it("returns the same value when nothing referenced the asset", () => {
    const state = { body: "hkp-asset://other" };
    expect(renameAssetRefs(state, "page", "player")).toBe(state);
  });
});

describe("a board's assets", () => {
  it("keeps what can be used and names what cannot", () => {
    const { assets, problems } = readBoardAssets([
      page,
      { id: "two", mediaType: "text/plain", text: "a", url: "https://x" },
      { id: "bad id!", mediaType: "text/plain", text: "a" },
      { id: "page", mediaType: "text/plain", text: "again" },
    ]);
    expect(assets).toEqual([page]);
    expect(problems).toHaveLength(3);
  });

  it("keeps the optional parts of a descriptor only where they are well-formed", () => {
    const pinned = "AB".repeat(32);
    const { assets, problems } = readBoardAssets([
      { id: "a", name: { en: "A" }, mediaType: "text/plain", text: "a", size: "9", sha256: 7 },
      {
        id: "b",
        name: "B",
        mediaType: "audio/wav",
        url: "https://example.com/b.wav",
        sha256: pinned,
        size: 12,
        headers: { authorization: "{{secret.token}}", retries: 3 },
        text: 5,
      },
      { id: "c", mediaType: "audio/wav", url: "https://example.com/c.wav", sha256: "abc", headers: "x" },
    ]);

    expect(problems).toEqual([]);
    expect(assets).toEqual([
      { id: "a", mediaType: "text/plain", text: "a" },
      {
        id: "b",
        name: "B",
        mediaType: "audio/wav",
        url: "https://example.com/b.wav",
        sha256: pinned.toLowerCase(),
        size: 12,
        headers: { authorization: "{{secret.token}}" },
      },
      { id: "c", mediaType: "audio/wav", url: "https://example.com/c.wav" },
    ]);
  });

  it("are a runtime's own document's: the board's, or its unit's", () => {
    const unitPage = { ...page, text: "<p>unit</p>" };
    const units = [{ name: "shop", source: { assets: [unitPage] } }];

    expect(assetsOfRuntime({}, [page], units)).toEqual([page]);
    expect(assetsOfRuntime(undefined, [page], units)).toEqual([page]);
    expect(assetsOfRuntime({ unit: "shop" }, [page], units)).toEqual([unitPage]);
    // A unit that declares none has none — never the board's.
    expect(assetsOfRuntime({ unit: "other" }, [page], units)).toEqual([]);
  });

  it("measures inline content", () => {
    expect(assetSize(page)).toBe(9);
    expect(assetSize({ id: "b", mediaType: "image/png", base64: "AQID" })).toBe(3);
    expect(assetSize(model)).toBeUndefined();
  });

  it("are replaced in place and appended when new", () => {
    const edited = { ...page, text: "v2" };
    expect(upsertAsset([page, app], edited)).toEqual([edited, app]);
    expect(upsertAsset([page], app)).toEqual([page, app]);
    const renamed = { ...page, id: "player" };
    expect(upsertAsset([page, app], renamed, "page")).toEqual([renamed, app]);
  });

  it("are given ids that are free", () => {
    expect(uniqueAssetId([page], "Page")).toBe("page-2");
    expect(uniqueAssetId([], "My Logo.png")).toBe("my-logo.png");
  });
});

describe("linking", () => {
  const origin = (boards: Record<string, UnitBoard>) =>
    defaultUnitOrigin((name) => boards[name] ?? null);

  it("carries a board's assets through units and blocks unchanged", async () => {
    const board: UnitBoard = {
      boardName: "Radio",
      runtimes: [{ id: "relay", name: "Relay", type: "rest", url: "http://127.0.0.1:8080" }],
      services: { relay: [] },
      assets: [page, app],
    };
    const projection = await linkBoard(board, origin({}));
    expect(projection.board.assets).toEqual([page, app]);
    const blocks = linkBlocks(projection.board, projection.units);
    expect(blocks.board.assets).toEqual([page, app]);
    expect(unlinkBlocks(blocks.board, blocks.linkage).assets).toEqual([page, app]);
  });

  it("keeps a unit's assets with the unit that declared them", async () => {
    const player: UnitBoard = {
      boardName: "Player",
      unit: { name: "player" },
      runtimes: [{ id: "relay", name: "Relay", type: "rest", url: "http://127.0.0.1:8080" }],
      services: { relay: [] },
      assets: [page],
    };
    const root: UnitBoard = {
      boardName: "Station",
      runtimes: [],
      services: {},
      assets: [app],
      units: [{ uri: "player" }],
    };
    const projection = await linkBoard(root, origin({ player }));
    expect(projection.board.assets).toEqual([app]);
    const placed = projection.units.find((unit) => unit.name === "player");
    expect(placed?.source.assets).toEqual([page]);
    expect(projection.board.runtimes[0].unit).toBe("player");
  });
});
