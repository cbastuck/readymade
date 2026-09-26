/**
 * What the Timeline's panel shows and how an edit becomes configuration.
 *
 * Kept apart from the components so every edit is a function from what the
 * service holds to what to configure it with, tested without a panel. Imports
 * only the timeline's arithmetic, never the service, which imports the panel.
 */
import {
  Ease,
  Keyframe,
  Keyframes,
  TimelineAction,
  valueAt,
} from "../timeline-core";

export type TimelineView = {
  clock: "own" | "input";
  object: Record<string, unknown> | null;
  keyframes: Keyframes;
  actions: TimelineAction[];
  length: number;
  loop: boolean;
  unit: "s" | "beats";
  fps: number;
  offset: number;
  speed: number;
  running: boolean;
  /** Where the timeline is, as it last said. */
  t: number;
};

export const EMPTY_VIEW: TimelineView = {
  clock: "own",
  object: null,
  keyframes: {},
  actions: [],
  length: 0,
  loop: false,
  unit: "s",
  fps: 30,
  offset: 0,
  speed: 1,
  running: false,
  t: 0,
};

/** A notification or the initial state, read over what the panel already has. */
export function readView(update: any, previous: TimelineView): TimelineView {
  if (!update || typeof update !== "object") {
    return previous;
  }
  const next = { ...previous };
  for (const key of Object.keys(EMPTY_VIEW) as (keyof TimelineView)[]) {
    if (update[key] !== undefined) {
      (next as any)[key] = update[key];
    }
  }
  return next;
}

/** Where keyframes and actions land when placed or moved: a twentieth of a unit. */
export const SNAP = 0.05;

export function snap(t: number): number {
  return Math.max(0, Math.round(Math.round(t / SNAP) * SNAP * 1e6) / 1e6);
}

/**
 * How much time the axis shows: the timeline's length, or for an unbounded
 * one, room past the last thing placed on it.
 */
export function displayLength(view: TimelineView): number {
  if (view.length > 0) {
    return view.length;
  }
  const ats = [
    ...Object.values(view.keyframes).flatMap((frames) => frames.map((k) => k.at)),
    ...view.actions.map((a) => a.at),
    view.t,
  ];
  return Math.max(4, Math.ceil(Math.max(...ats) * 1.25));
}

/** The properties worth offering for an object, by what it draws as. */
const SUGGESTED: Record<string, string[]> = {
  image: ["centerX", "centerY", "height", "rotate", "scale", "opacity"],
  rect: ["x", "y", "width", "height", "color"],
  circle: ["x", "y", "radius", "color"],
  text: ["x", "y", "text", "color"],
};

/** What a property is when neither the object nor a keyframe says. */
const DEFAULTS: Record<string, unknown> = {
  centerX: "50%",
  centerY: "50%",
  height: "100%",
  rotate: 0,
  scale: 1,
  opacity: 1,
};

/** The rows the editor shows: those suggested for the object, then any other keyframed. */
export function propertiesOf(view: TimelineView, extra: string[] = []): string[] {
  const type = typeof view.object?.type === "string" ? view.object.type : "";
  const rows = [...(SUGGESTED[type] ?? [])];
  for (const name of [...Object.keys(view.keyframes), ...extra]) {
    if (!rows.includes(name)) {
      rows.push(name);
    }
  }
  return rows;
}

export function isKeyframed(view: TimelineView, property: string): boolean {
  return (view.keyframes[property]?.length ?? 0) > 0;
}

/** A property's value at `t`, from its keyframes, else the object, else its default. */
export function valueOf(view: TimelineView, property: string, t: number): unknown {
  if (isKeyframed(view, property)) {
    return valueAt(view.keyframes[property], t);
  }
  const own = view.object?.[property];
  return own !== undefined ? own : DEFAULTS[property];
}

/** The object as it is drawn at `t`. */
export function objectAt(view: TimelineView, t: number): Record<string, unknown> | null {
  if (!view.object) {
    return null;
  }
  const drawn: Record<string, unknown> = { ...view.object };
  for (const property of Object.keys(view.keyframes)) {
    drawn[property] = valueAt(view.keyframes[property], t);
  }
  return drawn;
}

/** The keyframe of a property sitting at `t`, within half a snap, or -1. */
export function keyframeAt(frames: Keyframe[] | undefined, t: number): number {
  return (frames ?? []).findIndex((k) => Math.abs(k.at - t) < SNAP / 2);
}

type Edit = { keyframes?: Keyframes; object?: Record<string, unknown> };

function withFrames(keyframes: Keyframes, property: string, frames: Keyframe[]): Keyframes {
  const next = { ...keyframes };
  if (frames.length > 0) {
    next[property] = [...frames].sort((a, b) => a.at - b.at);
  } else {
    delete next[property];
  }
  return next;
}

function withProperty(view: TimelineView, property: string, value: unknown) {
  return { ...(view.object ?? {}), [property]: value };
}

/**
 * A value typed into a property's field at `t`. A keyframed property gets a
 * keyframe there — the one already there changes, else one is added. A
 * property not yet animated is a fixed value of the object, and changes as one.
 */
export function setValue(
  view: TimelineView,
  property: string,
  t: number,
  value: unknown,
): Edit {
  if (!isKeyframed(view, property)) {
    return { object: withProperty(view, property, value) };
  }
  const frames = [...view.keyframes[property]];
  const at = keyframeAt(frames, t);
  if (at >= 0) {
    frames[at] = { ...frames[at], value };
  } else {
    frames.push({ at: snap(t), value });
  }
  return { keyframes: withFrames(view.keyframes, property, frames) };
}

/**
 * The key button of a property at `t`. Where a keyframe sits, it is taken
 * away; elsewhere one is set at the value the property has there — so the
 * first press starts animating a fixed value. Taking the last keyframe away
 * leaves the value it had as the object's fixed value.
 */
export function toggleKey(view: TimelineView, property: string, t: number): Edit {
  const frames = view.keyframes[property] ?? [];
  const at = keyframeAt(frames, t);
  if (at >= 0) {
    return removeKeyframe(view, property, at);
  }
  const value = valueOf(view, property, t);
  return {
    keyframes: withFrames(view.keyframes, property, [
      ...frames,
      { at: snap(t), value: value ?? "" },
    ]),
  };
}

export function removeKeyframe(view: TimelineView, property: string, index: number): Edit {
  const frames = view.keyframes[property] ?? [];
  const removed = frames[index];
  const rest = frames.filter((_, i) => i !== index);
  const keyframes = withFrames(view.keyframes, property, rest);
  if (rest.length === 0 && removed) {
    return { keyframes, object: withProperty(view, property, removed.value) };
  }
  return { keyframes };
}

/** A keyframe moved to `to`; answers with where it is in the list now. */
export function moveKeyframe(
  keyframes: Keyframes,
  property: string,
  index: number,
  to: number,
): { keyframes: Keyframes; index: number } {
  const frames = keyframes[property] ?? [];
  const moved = { ...frames[index], at: snap(to) };
  const rest = frames.filter((_, i) => i !== index);
  const sorted = [...rest, moved].sort((a, b) => a.at - b.at);
  return {
    keyframes: withFrames(keyframes, property, sorted),
    index: sorted.indexOf(moved),
  };
}

export function setEase(
  keyframes: Keyframes,
  property: string,
  index: number,
  ease: Ease,
): Keyframes {
  const frames = (keyframes[property] ?? []).map((k, i) =>
    i === index ? { ...k, ease } : k,
  );
  return withFrames(keyframes, property, frames);
}

export const EASES: Ease[] = ["linear", "in", "out", "in-out", "step"];

export function addAction(actions: TimelineAction[], t: number): TimelineAction[] {
  return [...actions, { at: snap(t), data: {} }];
}

/** An action moved to `to`. Actions keep their list order: it breaks ties. */
export function moveAction(actions: TimelineAction[], index: number, to: number) {
  return actions.map((a, i) => (i === index ? { ...a, at: snap(to) } : a));
}

export function setActionData(actions: TimelineAction[], index: number, data: unknown) {
  return actions.map((a, i) => (i === index ? { ...a, data } : a));
}

export function removeAction(actions: TimelineAction[], index: number) {
  return actions.filter((_, i) => i !== index);
}

/** What a property field holds, as the value it stands for: numbers are numbers. */
export function parseFieldValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return trimmed;
}

export function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return String(Math.round(value * 1000) / 1000);
  }
  if (value === undefined || value === null) {
    return "";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function formatTime(t: number): string {
  return t.toFixed(2);
}

/**
 * The object after an image is dropped on the timeline: an image already
 * there only changes what it shows, anything else becomes an image, centred.
 */
export function withImage(
  object: Record<string, unknown> | null,
  url: string,
): Record<string, unknown> {
  if (object?.type === "image") {
    return { ...object, url };
  }
  return { type: "image", url, centerX: "50%", centerY: "50%", height: "60%" };
}
