import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import UnknownRemoteDialog from "./UnknownRemoteDialog";
import { askAboutRemote, resetRemotePrompt } from "../core/remotePrompt";
import { RuntimeClass } from "../types";
import { RemoteRuntimeStoreCtx } from "./toolbar/useRemoteRuntimeEditing";

/**
 * A board says `"remote": "node"` and this client keeps no server under that
 * name. The dialog is how the person says which one it is; what they say is
 * kept, so it is asked once.
 */

const laptop: RuntimeClass = {
  name: "Laptop",
  type: "rest",
  url: "http://laptop:8080",
};
const embedded: RuntimeClass = {
  name: "embedded",
  type: "rest",
  url: "hkp://remotes/embedded",
};

let engines: RuntimeClass[] = [];

vi.mock("hkp-frontend/src/BoardContext", () => ({
  useBoardContext: () => ({
    availableRuntimeEngines: engines,
    addAvailableRuntime: () => engines,
    updateAvailableRuntime: () => engines,
    removeAvailableRuntime: () => engines,
  }),
}));

const wanted = { name: "node", runtimeName: "Reader", kind: "hkp-node" };

function renderDialog(kept: RuntimeClass[]) {
  engines = [{ name: "Browser Runtime", type: "browser" }, ...kept];
  const store = { onAdd: vi.fn(), onRemove: vi.fn(), onUpdate: vi.fn() };
  render(
    <RemoteRuntimeStoreCtx.Provider value={store}>
      <UnknownRemoteDialog />
    </RemoteRuntimeStoreCtx.Provider>,
  );
  return store;
}

afterEach(() => {
  resetRemotePrompt();
});

describe("UnknownRemoteDialog", () => {
  it("shows nothing while every name resolves", () => {
    renderDialog([laptop]);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says which name, which runtime and what kind of server", async () => {
    renderDialog([laptop]);

    void askAboutRemote(wanted);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Which runtime server is “node”?");
    expect(dialog.textContent).toContain("Reader");
    expect(dialog.textContent).toContain("an hkp-node");
  });

  it("says what `embedded` is where there is no app around the board", async () => {
    renderDialog([laptop]);

    void askAboutRemote({ name: "embedded", runtimeName: "hkp-rt" });

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("the runtime the Readymade app embeds");
    expect(dialog.textContent).toContain("open the board in the app");
  });

  it("gives a server the person keeps the name as well, and keeps that", async () => {
    const store = renderDialog([laptop]);
    const answer = askAboutRemote(wanted);

    fireEvent.click(await screen.findByLabelText("Use Laptop as node"));

    const named = { ...laptop, aliases: ["node"] };
    expect(await answer).toEqual(named);
    // It keeps the name it has: the entry is replaced by itself with one more.
    expect(store.onUpdate).toHaveBeenCalledWith(laptop, named);
    expect(store.onAdd).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps a new server under the name, at the address the person gives", async () => {
    const store = renderDialog([]);
    const answer = askAboutRemote(wanted);

    fireEvent.change(await screen.findByLabelText("Address of node"), {
      // Stored as a base address, the way the add form stores one.
      target: { value: " http://127.0.0.1:8080/ " },
    });
    fireEvent.click(screen.getByText("Keep and open"));

    const added = { type: "rest", name: "node", url: "http://127.0.0.1:8080" };
    expect(await answer).toEqual(added);
    expect(store.onAdd).toHaveBeenCalledWith(added);
  });

  it("does not offer the runtime a host embeds, which is the host's own", async () => {
    renderDialog([embedded, laptop]);

    void askAboutRemote(wanted);

    await screen.findByLabelText("Use Laptop as node");
    expect(screen.queryByLabelText("Use embedded as node")).toBeNull();
  });

  it("answers with nothing, and keeps nothing, when dismissed", async () => {
    const store = renderDialog([laptop]);
    const answer = askAboutRemote(wanted);

    fireEvent.click(await screen.findByText("Do not open the board"));

    expect(await answer).toBeNull();
    expect(store.onUpdate).not.toHaveBeenCalled();
    expect(store.onAdd).not.toHaveBeenCalled();
  });

  it("asks about one name at a time", async () => {
    renderDialog([laptop]);
    const node = askAboutRemote(wanted);
    const python = askAboutRemote({ name: "python", runtimeName: "Speech" });

    fireEvent.click(await screen.findByLabelText("Use Laptop as node"));
    await node;

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog.textContent).toContain("Which runtime server is “python”?"),
    );
    fireEvent.click(screen.getByText("Do not open the board"));
    expect(await python).toBeNull();
  });
});
