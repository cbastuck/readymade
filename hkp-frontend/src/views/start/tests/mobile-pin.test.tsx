import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileBoardDetails from "../mobile/MobileBoardDetails";
import { BoardNode, isPinnable } from "../types";

/**
 * Pinning a board to the Home Screen from the mobile board details.
 *
 * Only a saved board and a demo can be pinned: they are the boards with an
 * identity that outlives the session, which is what a Home Screen icon opens
 * days later.
 */

const SAVED: BoardNode = {
  type: "board",
  name: "Morning radio",
  state: "saved",
  action: { kind: "saved", name: "Morning radio" },
};

describe("pinning from the mobile board details", () => {
  it("offers Pin on a board that is not pinned, and pins it", async () => {
    const onTogglePin = vi.fn(async () => {});
    render(
      <MobileBoardDetails board={SAVED} pinned={false} onTogglePin={onTogglePin} />,
    );

    fireEvent.click(screen.getByText("Pin to Home Screen"));

    await waitFor(() => expect(onTogglePin).toHaveBeenCalledTimes(1));
  });

  it("offers Unpin on a pinned board", () => {
    render(
      <MobileBoardDetails board={SAVED} pinned onTogglePin={async () => {}} />,
    );

    expect(screen.getByText("Unpin from Home Screen")).toBeTruthy();
    expect(screen.queryByText("Pin to Home Screen")).toBeNull();
  });

  it("says why pinning failed, and offers it again", async () => {
    render(
      <MobileBoardDetails
        board={SAVED}
        pinned={false}
        onTogglePin={async () => {
          throw new Error("This build cannot pin boards");
        }}
      />,
    );

    fireEvent.click(screen.getByText("Pin to Home Screen"));

    expect(await screen.findByText("This build cannot pin boards")).toBeTruthy();
    expect(screen.getByText("Pin to Home Screen")).toBeTruthy();
  });

  it("offers nothing on a host with no Home Screen", () => {
    render(<MobileBoardDetails board={SAVED} />);

    expect(screen.queryByText("Pin to Home Screen")).toBeNull();
  });

  it("pins saved boards and demos, and nothing else", () => {
    expect(isPinnable({ kind: "saved", name: "a" })).toBe(true);
    expect(isPinnable({ kind: "demo", slug: "b" })).toBe(true);
    expect(isPinnable({ kind: "source", name: "c", source: "{}" })).toBe(false);
    expect(
      isPinnable({ kind: "cloud", coordinatorUrl: "https://x", boardName: "d" }),
    ).toBe(false);
    expect(isPinnable(undefined)).toBe(false);
  });
});
