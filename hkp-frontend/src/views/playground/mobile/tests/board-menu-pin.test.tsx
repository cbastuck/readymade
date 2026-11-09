import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BoardMenuSheet from "../BoardMenuSheet";

/**
 * Pinning the open board to the Home Screen from the board menu — the same
 * Pin the start page's board details offer, without leaving the board.
 */

function menu(props: {
  pinned?: boolean;
  onTogglePin?: () => void;
  onClose?: () => void;
}) {
  return render(
    <BoardMenuSheet
      open
      onClose={props.onClose ?? (() => {})}
      onSave={() => {}}
      onShare={() => {}}
      onNew={() => {}}
      onDeploy={() => {}}
      pinned={props.pinned}
      onTogglePin={props.onTogglePin}
    />,
  );
}

describe("pinning from the board menu", () => {
  it("offers Pin on a board that is not pinned, and closes on it", () => {
    const onTogglePin = vi.fn();
    const onClose = vi.fn();
    menu({ pinned: false, onTogglePin, onClose });

    fireEvent.click(screen.getByText("Pin to Home Screen"));

    expect(onTogglePin).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers Unpin on a pinned board", () => {
    menu({ pinned: true, onTogglePin: () => {} });

    expect(screen.getByText("Unpin from Home Screen")).toBeTruthy();
    expect(screen.queryByText("Pin to Home Screen")).toBeNull();
  });

  it("offers nothing when there is nothing to pin, or nowhere to pin it", () => {
    menu({});

    expect(screen.queryByText("Pin to Home Screen")).toBeNull();
    expect(screen.queryByText("Unpin from Home Screen")).toBeNull();
  });
});
