import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import { AssetDescriptor } from "hkp-frontend/src/runtime/board/assets";
import AssetPanel, { EMPTY_ASSET_STATE } from "../AssetPanel";
import BlockUseFrame from "../BlockUse";

// The select is not what is under test: its options, listed.
vi.mock("hkp-frontend/src/components/shared/SelectorField", () => ({
  default: (props: { options: Record<string, string> }) => (
    <ul>
      {Object.entries(props.options).map(([value, label]) => (
        <li key={value}>{`${label} = ${value}`}</li>
      ))}
    </ul>
  ),
}));

/**
 * The `asset` panel offers what its service can resolve: the assets of the
 * document that contributed the runtime the panel is drawn on.
 */

const boardPage: AssetDescriptor = { id: "page", name: "Board page", mediaType: "text/html", text: "b" };
const boardOnly: AssetDescriptor = { id: "logo", name: "Logo", mediaType: "image/png", base64: "AQID" };
const unitPage: AssetDescriptor = { id: "page", name: "Shop page", mediaType: "text/html", text: "u" };

const board = {
  assets: [boardPage, boardOnly],
  runtimes: [
    { id: "ui", name: "Browser", type: "browser" },
    { id: "shop.ui", name: "Shop", type: "browser", unit: "shop" },
    { id: "bare.ui", name: "Bare", type: "browser", unit: "bare" },
  ],
  linkage: {
    units: [
      { name: "shop", source: { assets: [unitPage] } },
      { name: "bare", source: {} },
    ],
    views: [],
  },
} as unknown as BoardContextState;

function panelOn(runtimeId: string) {
  return render(
    <BoardCtx.Provider value={board}>
      <BlockUseFrame address="a" runtimeId={runtimeId}>
        <AssetPanel state={EMPTY_ASSET_STATE} configure={() => {}} />
      </BlockUseFrame>
    </BoardCtx.Provider>,
  );
}

describe("the asset panel", () => {
  it("offers the board's assets on one of the board's own runtimes", () => {
    panelOn("ui");

    expect(screen.getByText("Board page = hkp-asset://page")).toBeTruthy();
    expect(screen.getByText("Logo = hkp-asset://logo")).toBeTruthy();
  });

  it("offers a unit's assets on a runtime the unit contributed, and not the board's", () => {
    panelOn("shop.ui");

    expect(screen.getByText("Shop page = hkp-asset://page")).toBeTruthy();
    expect(screen.queryByText(/Board page/)).toBeNull();
    expect(screen.queryByText(/Logo/)).toBeNull();
  });

  it("says so when the unit declares none", () => {
    panelOn("bare.ui");

    expect(screen.getByText('The unit "bare" declares no assets.')).toBeTruthy();
  });
});
