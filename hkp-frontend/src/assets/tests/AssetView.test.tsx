import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BoardCtx, type BoardContextState } from "hkp-frontend/src/BoardContext";
import { AssetDescriptor, AssetUse } from "hkp-frontend/src/runtime/board/assets";
import { AssetPushFailure } from "hkp-frontend/src/core/assetActions";
import { RuntimeDescriptor } from "hkp-frontend/src/types";
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

const relay = { id: "relay", name: "Relay", type: "rest" } as RuntimeDescriptor;

type Answer = AssetPushFailure[] | void | Promise<AssetPushFailure[]>;

function Harness({
  initial,
  uses = [],
  setAsset,
  deleteAsset,
  next,
}: {
  initial: AssetDescriptor[];
  uses?: AssetUse[];
  /** What the board is asked to set; answers the runtimes that did not take it. */
  setAsset: (asset: AssetDescriptor, replacing?: string) => Answer;
  /** What the board is asked to delete; answers the runtimes still holding it. */
  deleteAsset?: (id: string) => Answer;
  /** The assets of the board that replaces this one when asked to. */
  next?: AssetDescriptor[];
}) {
  const [assets, setAssets] = useState(initial);
  const [boardGeneration, setBoardGeneration] = useState(0);
  const board = {
    assets,
    boardGeneration,
    runtimes: [relay],
    setAsset: async (asset: AssetDescriptor, replacing?: string) => {
      const failures = (await setAsset(asset, replacing)) ?? [];
      setAssets((prev) => [...prev.filter((entry) => entry.id !== (replacing ?? asset.id)), asset]);
      return failures;
    },
    deleteAsset: async (id: string) => {
      const failures = (await deleteAsset?.(id)) ?? [];
      setAssets((prev) => prev.filter((entry) => entry.id !== id));
      return failures;
    },
    assetUses: async () => uses,
    checkAsset: async () => [],
  } as unknown as BoardContextState;
  return (
    <BoardCtx.Provider value={board}>
      <AssetViewProvider>
        <Opener />
        <button
          onClick={() => {
            setAssets(next ?? []);
            setBoardGeneration((generation) => generation + 1);
          }}
        >
          replace board
        </button>
        <AssetView />
      </AssetViewProvider>
    </BoardCtx.Provider>
  );
}

function Opener() {
  const view = useAssetView();
  return <button onClick={() => view?.show()}>open</button>;
}

/** The notice last raised as a warning: its title, and what its action does. */
function lastWarning() {
  const [title, options] = vi.mocked(toast.warning).mock.calls.at(-1) ?? [];
  return { title, retry: (options as any)?.action?.onClick as (() => void) | undefined };
}

describe("the asset view", () => {
  beforeEach(() => {
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.success).mockClear();
  });

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

  it("names a runtime that did not take a change, and offers to send it again", async () => {
    const setAsset = vi
      .fn()
      .mockReturnValueOnce([
        { runtime: relay, problem: "Relay answered 503", push: { player: page } },
      ])
      .mockReturnValue([]);
    render(<Harness initial={[page]} setAsset={setAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset content"), {
      target: { value: "<p>v2</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    // Nothing left to edit, and still something to apply.
    expect(await screen.findByText(/Not on Relay/)).toBeTruthy();
    const apply = screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);

    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(2));
    expect(setAsset.mock.calls[1]).toEqual([{ ...page, text: "<p>v2</p>" }, "player"]);
    await waitFor(() => expect(screen.queryByText(/Not on Relay/)).toBeNull());
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops a draft when another board replaces the one it was started on", async () => {
    const setAsset = vi.fn();
    const theirs = { ...page, name: "Their player", text: "<p>theirs</p>" };
    render(<Harness initial={[page]} setAsset={setAsset} next={[theirs]} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset content"), {
      target: { value: "<p>mine</p>" },
    });
    fireEvent.click(screen.getByText("replace board"));

    // The next board has an asset of the same id; the draft is not shown over it.
    expect(await screen.findByText("Choose an asset, or start a new one.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();

    fireEvent.click(screen.getByRole("option", { name: /Their player/ }));
    expect(((await screen.findByLabelText("Asset content")) as HTMLTextAreaElement).value).toBe(
      "<p>theirs</p>",
    );
    expect(setAsset).not.toHaveBeenCalled();
  });

  it("shows nothing of an edit that finishes after another board was opened", async () => {
    let finish: (failures: AssetPushFailure[]) => void = () => {};
    const setAsset = vi.fn(
      () => new Promise<AssetPushFailure[]>((resolve) => (finish = resolve)),
    );
    render(<Harness initial={[page]} setAsset={setAsset} next={[]} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset content"), {
      target: { value: "<p>mine</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("replace board"));
    await screen.findByText("Choose an asset, or start a new one.");
    finish([{ runtime: relay, problem: "Relay answered 503", push: { player: page } }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Neither the draft back on screen nor a notice about a board that is gone.
    expect(screen.getByText("Choose an asset, or start a new one.")).toBeTruthy();
    expect(screen.queryByLabelText("Asset content")).toBeNull();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says which runtime still holds a deleted asset, and asks it again on retry", async () => {
    const deleteAsset = vi
      .fn()
      .mockReturnValueOnce([
        { runtime: relay, problem: "Relay is unreachable", push: { player: null } },
      ])
      .mockReturnValue([]);
    render(<Harness initial={[page]} setAsset={vi.fn()} deleteAsset={deleteAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Delete/ }));

    await waitFor(() => expect(lastWarning().title).toBe('"player" is still on Relay'));
    expect(screen.queryByRole("option", { name: /Player page/ })).toBeNull();

    lastWarning().retry!();
    await waitFor(() => expect(deleteAsset).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Removed "player" from the runtimes'),
    );
  });

  it("does not retry a deletion once an asset has been started under that id again", async () => {
    const deleteAsset = vi.fn(() => [
      { runtime: relay, problem: "Relay is unreachable", push: { player: null } },
    ]);
    const setAsset = vi.fn();
    render(<Harness initial={[page]} setAsset={setAsset} deleteAsset={deleteAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Delete/ }));
    await waitFor(() => expect(lastWarning().title).toBe('"player" is still on Relay'));
    const { retry } = lastWarning();

    fireEvent.click(screen.getByTitle("New inline text asset"));
    fireEvent.change(screen.getByLabelText("Asset id"), { target: { value: "player" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(setAsset).toHaveBeenCalledTimes(1));
    await screen.findByRole("option", { name: /player/ });

    retry!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deleteAsset).toHaveBeenCalledTimes(1);
  });

  it("renames, and says so when a runtime still holds the old id", async () => {
    const setAsset = vi.fn(() => [
      { runtime: relay, problem: "Relay answered 503", push: { player: null } },
    ]);
    render(<Harness initial={[page]} setAsset={setAsset} />);

    fireEvent.click(screen.getByRole("option", { name: /Player page/ }));
    fireEvent.change(await screen.findByLabelText("Asset id"), { target: { value: "page" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Renamed "player" to "page"'),
    );
    expect(lastWarning().title).toBe('"player" is still on Relay');
    // The renamed asset itself arrived: nothing left to apply.
    expect(screen.queryByText(/Not on Relay/)).toBeNull();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops a draft of a new asset with the board it was started on", async () => {
    render(<Harness initial={[]} setAsset={vi.fn()} />);

    fireEvent.click(screen.getByTitle("New inline text asset"));
    expect(screen.getByText("new — not applied yet")).toBeTruthy();
    fireEvent.click(screen.getByText("replace board"));

    await waitFor(() => expect(screen.queryByText("new — not applied yet")).toBeNull());
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
