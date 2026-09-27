import { describe, expect, it, vi } from "vitest";

import { UnitBoard } from "../../runtime/board/units";
import { defaultUnitOrigin, linkBoard } from "../linkUnits";
import {
  checkAddressesIntoUses,
  linkBlocks,
  unlinkBlocks,
  withUnitBlocks,
} from "../linkBlocks";
import { unlinkBoardDocuments } from "../boardPersistence";

vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn() } }));

function hitPipeline(state: Record<string, unknown>) {
  return [{ serviceId: "hookup.to/service/sound", instanceId: "sound", state }];
}

const hit = {
  id: "hit",
  name: "Hit",
  serviceId: "sub-service",
  params: { trigger: "kick" },
  state: { pipeline: hitPipeline({ trigger: "{{param.trigger}}" }) },
};

/** What the sound inside an expanded use of `hit` was configured with. */
const soundIn = (entry: any) => entry.state.pipeline[0].state;

function board(extra: Partial<UnitBoard> = {}): UnitBoard {
  return {
    boardName: "Drums",
    runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
    services: { ui: [{ block: "hit", uuid: "kick" } as any] },
    blocks: [hit],
    ...extra,
  };
}

describe("linkBlocks", () => {
  it("runs a board without its definitions and saves it with them", () => {
    const source = board();
    const linked = linkBlocks(source);
    expect(linked.diagnostics).toEqual([]);
    expect(linked.board.blocks).toBeUndefined();
    expect(linked.board.services.ui[0]).toMatchObject({ uuid: "kick" });
    expect(soundIn(linked.board.services.ui[0])).toEqual({ trigger: "kick" });
    const saved = unlinkBlocks(linked.board, linked.linkage);
    expect(saved.blocks).toEqual([{ ...hit, tags: undefined }]);
    expect(saved.services).toEqual(source.services);
  });

  it("reads a definition as a preset, and says what is wrong with one that is not", () => {
    const { diagnostics } = linkBlocks(board({ blocks: [{ id: "x", name: "X" } as any] }));
    expect(diagnostics[0]).toMatchObject({
      level: "error",
      code: "block-invalid",
      message: expect.stringContaining('Not a block: "serviceId" is missing'),
    });
  });

  it("leaves a board with no blocks and no uses as it is", () => {
    const plain = board({ blocks: undefined, services: { ui: [] } });
    const linked = linkBlocks(plain);
    expect(linked.linkage).toBeUndefined();
    expect(linked.board).toEqual(plain);
  });
});

describe("blocks in units", () => {
  const unit: UnitBoard = {
    boardName: "Shop",
    unit: { name: "shop", params: { trigger: "snare" } },
    runtimes: [{ id: "intake", name: "In", type: "browser" }],
    services: {
      intake: [{ block: "hit", uuid: "bell", params: { trigger: "{{param.trigger}}" } } as any],
    },
    blocks: [
      {
        ...hit,
        name: "Shop hit",
        state: { pipeline: hitPipeline({ trigger: "{{param.trigger}}", shop: true }) },
      },
    ],
  };
  const composition: UnitBoard = {
    boardName: "Mall",
    runtimes: [],
    services: {},
    units: [{ uri: "shop" }],
    blocks: [hit],
  };

  async function project() {
    const projection = await linkBoard(
      composition,
      defaultUnitOrigin((name) => (name === "shop" ? unit : null)),
    );
    return { projection, linked: linkBlocks({ ...projection.board, blocks: composition.blocks }, projection.units) };
  }

  it("expands a unit's uses with the unit's own blocks, and the unit's params in the use", async () => {
    const { linked } = await project();
    expect(linked.diagnostics).toEqual([]);
    // The unit's parameter reached the use; the block's own reference to
    // `trigger` is the block's parameter, which the unit never touched.
    expect(soundIn(linked.board.services["shop.intake"][0])).toEqual({ trigger: "snare", shop: true });
  });

  it("saves each document with its own blocks and its uses as written", async () => {
    const { projection, linked } = await project();
    const documents = unlinkBoardDocuments(linked.board, {
      units: projection.units,
      views: projection.views,
      blocks: linked.linkage,
    });
    expect(documents.composition.blocks).toEqual([{ ...hit, tags: undefined }]);
    const [saved] = documents.units;
    expect(saved.board.services).toEqual(unit.services);
    expect(saved.board.blocks).toEqual([{ ...unit.blocks![0], tags: undefined }]);
  });

  it("writes a unit back with the blocks linkage holds for it", () => {
    const linkage = { definitions: { shop: [hit] }, placed: [] };
    expect(withUnitBlocks("shop", unit, linkage).blocks).toEqual([hit]);
    expect(withUnitBlocks("other", unit, linkage)).toBe(unit);
  });
});

describe("addresses into a use", () => {
  const sub = {
    id: "pair",
    name: "Pair",
    serviceId: "sub-service",
    state: {
      pipeline: [
        { serviceId: "hookup.to/service/sound", instanceId: "hit", state: {} },
        {
          serviceId: "hookup.to/service/configurator",
          instanceId: "own",
          state: { targetServiceUuid: "pair.hit" },
        },
      ],
    },
  };
  const linked = linkBlocks(
    board({
      blocks: [sub],
      services: {
        ui: [
          { block: "pair", uuid: "pair" } as any,
          {
            uuid: "outside",
            serviceId: "hookup.to/service/configurator",
            serviceName: "C",
            state: { targetServiceUuid: "pair.hit" },
          },
        ],
      },
    }),
  );

  it("are reported for facade widgets and Configurators outside the use", () => {
    const diagnostics = checkAddressesIntoUses(linked.board, linked.linkage, [
      { panels: [{ layout: { type: "knob", action: { serviceUuid: "pair.hit" } } }] },
      { panels: [{ layout: { type: "button", actions: [{ serviceUuid: "pair" }] } }] },
    ]);
    expect(diagnostics.map((entry) => entry.message)).toEqual([
      expect.stringMatching(/^A facade widget addresses "pair\.hit"/),
      expect.stringMatching(/^Configurator "outside" addresses "pair\.hit"/),
    ]);
  });

  it("leave a block configuring its own parts alone", () => {
    const diagnostics = checkAddressesIntoUses(linked.board, linked.linkage, []);
    expect(diagnostics.some((entry) => entry.message.includes('"pair.own"'))).toBe(false);
  });
});
