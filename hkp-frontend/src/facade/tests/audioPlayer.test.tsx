import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LayoutNode } from "../panels/LayoutNode";
import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import type { LayoutItem } from "../types";

/**
 * A run of audio files played as one sitting.
 *
 * What is pinned here is the part that makes a list of addresses into a
 * programme, and the part that keeps it from falling apart while it runs: one
 * track ending starts the next, and a list that arrives again — which for a
 * board polling a library is most of the time — leaves what is playing alone.
 *
 * The browser's own controls do the playing; nothing below tests those.
 */

const notified: unknown[] = [];

vi.mock("../panels/renderers/StatusIndicatorRenderer", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../panels/renderers/StatusIndicatorRenderer")
  >()),
  useNotificationValue: (_ctx: unknown, source: unknown) =>
    source ? notified[0] : undefined,
}));

const boardContext = { scopes: {}, services: {}, runtimes: [] } as unknown as BoardContextState;

const play = vi.fn(() => Promise.resolve());
// jsdom has no media stack at all, so playing is stubbed; what the widget is
// responsible for is which address is loaded and when play is asked for.
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: play,
});

const player: LayoutItem = {
  type: "audio-player",
  source: { serviceUuid: "seen", path: "episodes" },
  url: "{{item.base}}/{{item.path}}",
} as LayoutItem;

function episodes(...paths: string[]) {
  return paths.map((path) => ({ base: "http://host/hosted/abc", path }));
}

function renderPlayer(item: LayoutItem = player) {
  return render(
    <LayoutNode
      item={item}
      boardContext={boardContext}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

function src(container: HTMLElement): string | null {
  return container.querySelector("audio")?.getAttribute("src") ?? null;
}

beforeEach(() => {
  play.mockClear();
  notified.length = 0;
});

describe("audio-player", () => {
  it("names a track after its address and loads the first one", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container } = renderPlayer();

    expect(src(container)).toBe("http://host/hosted/abc/one.mp3");
    expect(screen.getAllByText("one")).not.toHaveLength(0);
    expect(screen.getByText("1 of 2")).toBeTruthy();
    // Nothing plays until someone asks.
    expect(play).not.toHaveBeenCalled();
  });

  it("starts the next track when one ends", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container } = renderPlayer();

    fireEvent.ended(container.querySelector("audio")!);

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).toHaveBeenCalled();
  });

  it("stops after the last track unless it loops", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container } = renderPlayer();

    fireEvent.ended(container.querySelector("audio")!);
    play.mockClear();
    fireEvent.ended(container.querySelector("audio")!);

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).not.toHaveBeenCalled();

    const looping = { ...(player as object), loop: true } as LayoutItem;
    const second = renderPlayer(looping);
    fireEvent.ended(second.container.querySelector("audio")!);
    fireEvent.ended(second.container.querySelector("audio")!);
    expect(src(second.container)).toBe("http://host/hosted/abc/one.mp3");
  });

  it("leaves the playing track alone when the list arrives again", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container, rerender } = renderPlayer();

    fireEvent.ended(container.querySelector("audio")!);
    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    play.mockClear();

    // A refresh, with one new episode at the front: a different array, a
    // different order, and the same track still playing.
    notified[0] = episodes("three.mp3", "one.mp3", "two.mp3");
    rerender(
      <LayoutNode
        item={player}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByText("3 of 3")).toBeTruthy();
  });

  it("moves to the start when the playing track is gone", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container, rerender } = renderPlayer();

    notified[0] = episodes("three.mp3", "two.mp3");
    rerender(
      <LayoutNode
        item={player}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );

    expect(src(container)).toBe("http://host/hosted/abc/three.mp3");
  });

  it("plays the track a person picks from the list", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container } = renderPlayer();

    fireEvent.click(screen.getByText("two"));

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).toHaveBeenCalled();
  });

  it("takes a title and a subtitle from the item", () => {
    notified[0] = [
      { base: "http://host", path: "a.mp3", headline: "Buffett steps back", when: "18 Sep" },
    ];
    renderPlayer({
      ...(player as object),
      title: "{{item.headline}}",
      subtitle: "{{item.when}}",
    } as LayoutItem);

    expect(screen.getAllByText("Buffett steps back")).not.toHaveLength(0);
    expect(screen.getAllByText("18 Sep")).not.toHaveLength(0);
  });

  it("says so when there is nothing to play", () => {
    notified[0] = [];
    renderPlayer({ ...(player as object), placeholder: "Nothing rendered yet." } as LayoutItem);

    expect(screen.getByText("Nothing rendered yet.")).toBeTruthy();
  });
});

describe("audio-player autoplay", () => {
  const station = { ...(player as object), autoplay: true } as LayoutItem;

  function rerenderWith(rerender: (ui: React.ReactElement) => void) {
    rerender(
      <LayoutNode
        item={station}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />,
    );
  }

  it("starts a newly arrived episode when nobody is listening", () => {
    notified[0] = episodes("one.mp3");
    const { container, rerender } = renderPlayer(station);

    // Someone listened once; the station is allowed to speak from here on.
    fireEvent.play(container.querySelector("audio")!);
    fireEvent.ended(container.querySelector("audio")!);
    play.mockClear();

    notified[0] = episodes("one.mp3", "two.mp3");
    rerenderWith(rerender);

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).toHaveBeenCalled();
  });

  it("does not restart the list it just finished", () => {
    notified[0] = episodes("one.mp3", "two.mp3");
    const { container, rerender } = renderPlayer(station);

    fireEvent.play(container.querySelector("audio")!);
    fireEvent.ended(container.querySelector("audio")!);
    fireEvent.ended(container.querySelector("audio")!);
    play.mockClear();

    // The same list, polled again: nothing here is new, so nothing starts.
    notified[0] = episodes("one.mp3", "two.mp3");
    rerenderWith(rerender);

    expect(play).not.toHaveBeenCalled();
    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
  });

  it("stays quiet until someone has played something", () => {
    notified[0] = episodes("one.mp3");
    const { rerender } = renderPlayer(station);

    notified[0] = episodes("one.mp3", "two.mp3");
    rerenderWith(rerender);

    expect(play).not.toHaveBeenCalled();
  });
});

describe("audio-player with a file that will not play", () => {
  it("skips to the next track", () => {
    notified[0] = episodes("broken.mp3", "two.mp3");
    const { container } = renderPlayer();

    fireEvent.error(container.querySelector("audio")!);

    expect(src(container)).toBe("http://host/hosted/abc/two.mp3");
    expect(play).toHaveBeenCalled();
  });

  it("goes quiet rather than racing through a list where nothing plays", () => {
    notified[0] = episodes("a.mp3", "b.mp3", "c.mp3");
    const { container } = renderPlayer({ ...(player as object), loop: true } as LayoutItem);

    fireEvent.error(container.querySelector("audio")!);
    fireEvent.error(container.querySelector("audio")!);
    play.mockClear();
    fireEvent.error(container.querySelector("audio")!);

    // Every track has now been tried once; looping would only try them again.
    expect(play).not.toHaveBeenCalled();
    expect(src(container)).toBe("http://host/hosted/abc/c.mp3");
  });
})
