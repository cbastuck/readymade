/**
 * The Timeline's panel and editor, on a real Timeline: what is pressed or
 * typed configures the service, and what the service says comes back to the
 * panel through its notifications, as on a board.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import TimelineDescriptor from "../Timeline";
import BlockUseFrame from "../../../ui/BlockUse";

const image = { type: "image", url: "a.png", height: "20%" };
const rotate = [
  { at: 0, value: 0 },
  { at: 2, value: 360 },
];

function createTimeline(state: Record<string, unknown>) {
  const targets = new Set<(n: any) => void>();
  const app = {
    notify: (_svc: unknown, n: any) => targets.forEach((target) => target(n)),
    next: vi.fn(),
    sendAction: vi.fn(),
    registerNotificationTarget: (_svc: unknown, target: (n: any) => void) =>
      targets.add(target),
    unregisterNotificationTarget: (_svc: unknown, target: (n: any) => void) =>
      targets.delete(target),
  };
  const service = TimelineDescriptor.create(app as any, "board", {} as any, "tl") as any;
  service.configure(state);
  return { service, app };
}

async function renderTimeline(
  state: Record<string, unknown>,
  { insideBlockUse = false } = {},
) {
  const { service, app } = createTimeline(state);
  const configure = vi.spyOn(service, "configure");
  const UI = TimelineDescriptor.createUI;
  const panel = React.createElement(UI, { service, onServiceAction: vi.fn() } as any);
  render(
    insideBlockUse
      ? React.createElement(BlockUseFrame, { address: "tl", locked: true }, panel)
      : panel,
  );
  await screen.findByText(/\/ 4\.00 s/);
  return { service, app, configure };
}

/** Presses an element at a fraction of its width. */
function pressAt(element: Element, fraction: number) {
  fireEvent.pointerDown(element, { clientX: 400 * fraction, pointerId: 1 });
  fireEvent.pointerUp(element, { pointerId: 1 });
}

/** The value field on a property's row in the editor. */
function fieldOf(property: string): HTMLInputElement {
  const row = screen.getByText(property).parentElement as HTMLElement;
  return row.querySelector("input") as HTMLInputElement;
}

function openEditor() {
  fireEvent.click(screen.getByTitle("Show the timeline's rows"));
  return screen.findByText("actions");
}

// jsdom has no PointerEvent, and the plain Event it falls back to carries no
// position; a MouseEvent does.
if (typeof window.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as any).PointerEvent = PointerEvent;
}

beforeEach(() => {
  // jsdom lays nothing out: every element is 400 px wide from the left edge.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 20,
    right: 400,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Timeline panel", () => {
  it("plays and pauses the timeline's own clock", async () => {
    const { service, configure } = await renderTimeline({ length: 4, object: image });
    fireEvent.click(screen.getByTitle("Play"));
    expect(configure).toHaveBeenCalledWith({ play: true });
    await screen.findByTitle("Pause");
    fireEvent.click(screen.getByTitle("Pause"));
    expect(service.state.running).toBe(false);
  });

  it("seeks where the ruler is pressed, and the playhead follows", async () => {
    const { configure } = await renderTimeline({ length: 4, object: image });
    const ruler = screen.getByText("0").closest(".cursor-ew-resize") as HTMLElement;
    pressAt(ruler, 0.5);
    expect(configure).toHaveBeenCalledWith({ seek: 2 });
    await screen.findByText(/^2\.00/);
  });

  it("offers to choose an image to animate", async () => {
    await renderTimeline({ length: 4 });
    expect(screen.getByTitle("Choose an image to animate")).toBeTruthy();
  });

  it("grows to show its rows in place, and back", async () => {
    await renderTimeline({ length: 4, object: image });
    expect(screen.queryByText("actions")).toBeNull();
    await openEditor();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("rotate")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Back to the compact view"));
    await waitFor(() => expect(screen.queryByText("actions")).toBeNull());
  });
});

describe("the Timeline editor", () => {
  it("sets the value of a keyframed property at the playhead as a keyframe", async () => {
    const { service } = await renderTimeline({ length: 4, object: image, keyframes: { rotate } });
    await openEditor();
    act(() => service.configure({ seek: 1 }));
    await waitFor(() => expect(fieldOf("rotate").value).toBe("180"));

    const field = fieldOf("rotate");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "90" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.blur(field);

    expect(service.state.keyframes.rotate).toEqual([
      { at: 0, value: 0 },
      { at: 1, value: 90 },
      { at: 2, value: 360 },
    ]);
  });

  it("changes a fixed value of the object when the property is not animated", async () => {
    const { service } = await renderTimeline({ length: 4, object: image });
    await openEditor();
    const field = fieldOf("height");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "40%" } });
    fireEvent.blur(field);
    expect(service.state.object).toEqual({ ...image, height: "40%" });
    expect(service.state.keyframes).toEqual({});
  });

  it("starts animating a property from its key button", async () => {
    const { service } = await renderTimeline({ length: 4, object: image });
    await openEditor();
    const row = screen.getByText("height").parentElement as HTMLElement;
    fireEvent.click(row.querySelector("button[title='Set a keyframe here']")!);
    expect(service.state.keyframes).toEqual({ height: [{ at: 0, value: "20%" }] });
  });

  it("moves a keyframe dragged along its lane, and eases it once picked", async () => {
    const { service } = await renderTimeline({ length: 4, object: image, keyframes: { rotate } });
    await openEditor();
    const diamond = screen.getByTitle("360 at 2.00");
    const lane = diamond.parentElement as HTMLElement;
    fireEvent.pointerDown(diamond, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(lane, { pointerId: 1 });
    expect(service.state.keyframes.rotate).toEqual([
      { at: 0, value: 0 },
      { at: 3, value: 360 },
    ]);

    fireEvent.pointerDown(screen.getByTitle("0 at 0.00"), { pointerId: 1 });
    await screen.findByText(/towards the next keyframe/);
    expect(screen.getByText("rotate at 0.00: 0")).toBeTruthy();
  });

  it("places an action at the playhead and edits what it emits", async () => {
    const { service } = await renderTimeline({ length: 4, object: image });
    await openEditor();
    fireEvent.click(screen.getByTitle("Place an action at the playhead"));
    expect(service.state.actions).toEqual([{ at: 0, data: {} }]);

    const data = await screen.findByText(/emits/);
    const field = data.parentElement!.querySelector("input")!;
    fireEvent.change(field, { target: { value: '{"scene":"b"}' } });
    fireEvent.blur(field);
    expect(service.state.actions).toEqual([{ at: 0, data: { scene: "b" } }]);
  });
});

describe("placing names", () => {
  it("places a name at the playhead, and moves and stretches its bar", async () => {
    const { service } = await renderTimeline({ length: 4 });
    await openEditor();
    const name = await screen.findByPlaceholderText("+ place a name at the playhead");
    fireEvent.change(name, { target: { value: "star" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(service.state.placements).toEqual([{ name: "star", at: 0, duration: 1 }]);

    const bar = await screen.findByTitle("star: 0.00 for 1.00");
    const lane = bar.parentElement as HTMLElement;
    fireEvent.pointerDown(bar, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(lane, { pointerId: 1 });
    expect(service.state.placements).toEqual([{ name: "star", at: 1, duration: 1 }]);

    const edge = (await screen.findByTitle("star: 1.00 for 1.00")).querySelector(
      "[title='Drag to change how long it plays']",
    ) as HTMLElement;
    fireEvent.pointerDown(edge, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(lane, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(lane, { pointerId: 1 });
    expect(service.state.placements).toEqual([{ name: "star", at: 1, duration: 2 }]);
    await waitFor(() =>
      expect((screen.getByTitle("Lasts") as HTMLInputElement).value).toBe("2"),
    );
    expect((screen.getByTitle("Starts at") as HTMLInputElement).value).toBe("1");

    const lasts = screen.getByTitle("Lasts") as HTMLInputElement;
    fireEvent.focus(lasts);
    fireEvent.change(lasts, { target: { value: "0.5" } });
    fireEvent.blur(lasts);
    expect(service.state.placements).toEqual([{ name: "star", at: 1, duration: 0.5 }]);
  });
});

describe("a driven Timeline", () => {
  it("pins its playhead where it is pressed instead of seeking, until told to follow", async () => {
    const { configure } = await renderTimeline({
      clock: "input",
      length: 4,
      object: image,
    });
    const ruler = screen.getByText("0").closest(".cursor-ew-resize") as HTMLElement;
    pressAt(ruler, 0.75);
    expect(configure).not.toHaveBeenCalledWith({ seek: expect.anything() });
    await screen.findByText(/^3\.00/);

    fireEvent.click(screen.getByTitle("Follow the time driving this timeline again"));
    await screen.findByText(/^0\.00/);
  });

  it("says when nothing places the name it takes", async () => {
    const { service } = await renderTimeline({
      clock: "input",
      length: 4,
      object: image,
      placement: "star",
    });
    act(() => {
      service.process({ t: 0, placements: { moon: null } });
    });
    expect(await screen.findByText('nothing places "star"')).toBeTruthy();
    act(() => {
      service.process({ t: 0, placements: { star: { progress: 0.5, elapsed: 1 } } });
    });
    expect(await screen.findByText('plays as "star"')).toBeTruthy();
  });
});

describe("a Timeline inside a use of a block", () => {
  const state = { length: 4, object: image, keyframes: { rotate }, actions: [{ at: 1, data: { a: 1 } }] };

  it("can still be opened, and shows itself read-only", async () => {
    const { configure } = await renderTimeline(state, { insideBlockUse: true });
    const expand = screen.getByTitle("Show the timeline's rows");
    expect(expand.closest("[inert]")).toBeNull();
    expect(screen.queryByTitle("Choose an image to animate")).toBeNull();
    expect((screen.getByTitle("Play") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("read-only")).toBeTruthy();

    const ruler = screen.getByText("0").parentElement!.parentElement as HTMLElement;
    pressAt(ruler, 0.5);

    fireEvent.click(expand);
    await screen.findByText("properties");
    expect(fieldOf("rotate").readOnly).toBe(true);
    const row = screen.getByText("height").parentElement as HTMLElement;
    expect((row.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByTitle("Place an action at the playhead") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByPlaceholderText("+ property")).toBeNull();

    expect(configure).not.toHaveBeenCalled();
  });

  it("shows a picked keyframe or action without offering to change it", async () => {
    const { configure, service } = await renderTimeline(state, { insideBlockUse: true });
    fireEvent.click(screen.getByTitle("Show the timeline's rows"));
    await screen.findByText("properties");

    const diamond = screen.getByTitle("360 at 2.00");
    fireEvent.pointerDown(diamond, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(diamond.parentElement!, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(diamond.parentElement!, { pointerId: 1 });
    expect(await screen.findByText("rotate at 2.00: 360")).toBeTruthy();
    expect(screen.queryByTitle("Remove")).toBeNull();

    fireEvent.pointerDown(screen.getByTitle('{"a":1} at 1.00'), { pointerId: 1 });
    const data = (await screen.findByText(/emits/)).parentElement!.querySelector("input")!;
    expect(data.readOnly).toBe(true);

    expect(service.state.keyframes.rotate[1].at).toBe(2);
    expect(configure).not.toHaveBeenCalled();
  });
});
