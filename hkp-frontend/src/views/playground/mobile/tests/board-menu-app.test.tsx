import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BoardMenuSheet from "../BoardMenuSheet";

/**
 * Choosing, from the board menu, whether the pinned board opens from the Home
 * Screen as an app — its facade on the whole screen — or with the board.
 */

function menu(props: {
  pinned?: boolean;
  opensAsApp?: boolean;
  onToggleOpensAsApp?: () => void;
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
      onTogglePin={() => {}}
      opensAsApp={props.opensAsApp}
      onToggleOpensAsApp={props.onToggleOpensAsApp}
    />,
  );
}

describe("opening a pin as an app, from the board menu", () => {
  it("offers it on a pinned board, and closes on it", () => {
    const onToggleOpensAsApp = vi.fn();
    const onClose = vi.fn();
    menu({ pinned: true, onToggleOpensAsApp, onClose });

    fireEvent.click(screen.getByText("Open as app from Home Screen"));

    expect(onToggleOpensAsApp).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers the way back on a pin that opens as an app", () => {
    menu({ pinned: true, opensAsApp: true, onToggleOpensAsApp: () => {} });

    expect(screen.getByText("Open with the board from Home Screen")).toBeTruthy();
    expect(screen.queryByText("Open as app from Home Screen")).toBeNull();
  });

  it("offers nothing on a board that is not pinned, or has no app to open as", () => {
    menu({ pinned: false, onToggleOpensAsApp: () => {} });
    expect(screen.queryByText("Open as app from Home Screen")).toBeNull();
  });

  it("offers nothing where the shell keeps no such choice", () => {
    menu({ pinned: true });
    expect(screen.queryByText("Open as app from Home Screen")).toBeNull();
  });
});
