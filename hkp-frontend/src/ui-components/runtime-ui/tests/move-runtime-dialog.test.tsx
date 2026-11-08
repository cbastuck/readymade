import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import MoveRuntimeDialog from "../MoveRuntimeDialog";

/**
 * Where a runtime is moved to. Names alone do not say which server is this
 * machine, so each server is shown with its address, the one the runtime is on
 * is marked, and a move that fails is said beside the server it was meant for.
 */

const LAPTOP = {
  name: "nodeJS",
  type: "rest" as const,
  url: "http://127.0.0.1:8080",
  aliases: ["node"],
};
const CLOUD = {
  name: "readymadeit.com",
  type: "rest" as const,
  url: "https://node1.readymadeit.com",
};
const CLUB = { id: "club", name: "Club", type: "rest" as const, url: LAPTOP.url };

function open(onMove = vi.fn(async () => {}), onClose = vi.fn()) {
  render(
    <MoveRuntimeDialog
      isOpen
      runtime={CLUB}
      servers={[LAPTOP, CLOUD]}
      onMove={onMove}
      onClose={onClose}
    />,
  );
  return { onMove, onClose };
}

describe("the move runtime dialog", () => {
  afterEach(cleanup);

  it("lists every server with its address, the runtime's own marked", () => {
    open();

    expect(screen.getByText("http://127.0.0.1:8080 · also node")).toBeTruthy();
    expect(screen.getByText(CLOUD.url)).toBeTruthy();
    expect(screen.getByText("here")).toBeTruthy();
    // The server it is on is not somewhere to move it.
    expect(screen.queryByLabelText("Move to nodeJS")).toBeNull();
    expect(screen.getByText(/What nodeJS keeps for this board/)).toBeTruthy();
  });

  it("moves it to the server chosen, and closes", async () => {
    const { onMove, onClose } = open();

    fireEvent.click(screen.getByLabelText("Move to readymadeit.com"));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onMove).toHaveBeenCalledWith(CLOUD);
  });

  it("says why beside the server, and stays open, when the move fails", async () => {
    const { onClose } = open(
      vi.fn(async () => {
        throw new Error("Failed to create runtime");
      }),
    );

    fireEvent.click(screen.getByLabelText("Move to readymadeit.com"));

    expect(
      await screen.findByText(/still on nodeJS\. Failed to create runtime/),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("Move to readymadeit.com") as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("lists where a runtime runs that no kept server is at", () => {
    render(
      <MoveRuntimeDialog
        isOpen
        runtime={{ ...CLUB, url: "http://10.0.0.7:8080" }}
        servers={[LAPTOP, CLOUD]}
        onMove={vi.fn(async () => {})}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByText("http://10.0.0.7:8080").length).toBeGreaterThan(0);
    expect(screen.getByText("here")).toBeTruthy();
    expect(screen.getByLabelText("Move to nodeJS")).toBeTruthy();
  });
});
