import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import { AssetDescriptor, AssetUse } from "hkp-frontend/src/runtime/board/assets";
import AssetView from "../AssetView";
import { AssetViewProvider, useAssetView } from "../AssetViewContext";

// The code editor is not what is under test: a textarea standing in for it.
vi.mock("hkp-frontend/src/components/shared/Editor", () => ({
  default: (props: any) => (
    <textarea
      aria-label="Asset content"
      value={props.value}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ),
}));
vi.mock("monaco-editor/esm/vs/basic-languages/html/html.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/css/css.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/xml/xml.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution", () => ({}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

/**
 * The asset view, driven as a person would: open an asset, edit it, apply; start
 * one; see where one is used. The board behind it is a stand-in that records
 * what the view asked of it.
 */

const page: AssetDescriptor = { id: "player", name: "Player page", mediaType: "text/html", text: "<p>v1</p>" };

function Harness({
  initial,
  uses = [],
  setAsset,
}: {
  initial: AssetDescriptor[];
  uses?: AssetUse[];
  setAsset: (asset: AssetDescriptor, replacing?: string) => void;
}) {
  const [assets, setAssets] = useState(initial);
  const board = {
    assets,
    runtimes: [{ id: "relay", name: "Relay", type: "rest" }],
    setAsset: async (asset: AssetDescriptor, replacing?: string) => {
      setAsset(asset, replacing);
      setAssets((prev) => [...prev.filter((entry) => entry.id !== (replacing ?? asset.id)), asset]);
    },
    deleteAsset: async () => {},
    assetUses: async () => uses,
    checkAsset: async () => [],
  } as unknown as BoardContextState;
  return (
    <BoardCtx.Provider value={board}>
      <AssetViewProvider>
        <Opener />
        <AssetView />
      </AssetViewProvider>
    </BoardCtx.Provider>
  );
}

function Opener() {
  const view = useAssetView();
  return <button onClick={() => view?.show()}>open</button>;
}

describe("the asset view", () => {
  it("lists the board's assets and applies an edit", async () => {
    const setAsset = vi.fn();
    render(<Harness initial={[page]} setAsset={setAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    const content = await screen.findByLabelText("Asset content");
    expect((content as HTMLTextAreaElement).value).toBe("<p>v1</p>");

    const apply = screen.getByRole("button", { name: "Apply" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(content, { target: { value: "<p>v2</p>" } });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);

    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(1));
    expect(setAsset.mock.calls[0]).toEqual([{ ...page, text: "<p>v2</p>" }, "player"]);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true),
    );
  });

  it("starts a new text asset, and keeps it open once applied", async () => {
    const setAsset = vi.fn();
    render(<Harness initial={[]} setAsset={setAsset} />);

    fireEvent.click(screen.getByTitle("New inline text asset"));
    expect(screen.getByText("new — not applied yet")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Asset id"), { target: { value: "card" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(1));
    expect(setAsset.mock.calls[0][0].id).toBe("card");
    expect(setAsset.mock.calls[0][1]).toBeUndefined();
    // Still open on what was just applied, not blanked.
    await waitFor(() =>
      expect((screen.getByLabelText("Asset id") as HTMLInputElement).value).toBe("card"),
    );
    expect(screen.queryByText("new — not applied yet")).toBeNull();
  });

  it("renames by applying under a new id", async () => {
    const setAsset = vi.fn();
    render(<Harness initial={[page]} setAsset={setAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset id"), { target: { value: "page" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(1));
    expect(setAsset.mock.calls[0]).toEqual([{ ...page, id: "page" }, "player"]);
  });

  it("refuses an id that is not one", async () => {
    const setAsset = vi.fn();
    render(<Harness initial={[page]} setAsset={setAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset id"), { target: { value: "no/slashes" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(setAsset).not.toHaveBeenCalled();
  });

  it("says where an asset is used", async () => {
    render(
      <Harness
        initial={[page]}
        setAsset={vi.fn()}
        uses={[
          {
            runtimeId: "relay",
            serviceUuid: "radio",
            serviceName: "Radio",
            path: ["onRequest", 0, "state", "template", "body"],
            assetId: "player",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    expect(await screen.findByText("Radio")).toBeTruthy();
    expect(screen.getByText(/Relay · onRequest\.0\.state\.template\.body/)).toBeTruthy();
  });
});
