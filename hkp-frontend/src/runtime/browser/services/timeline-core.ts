/**
 * Which of a timeline's actions are due in a stretch of time.
 *
 * Kept apart from the service so the arithmetic is tested without a clock.
 * Positions here are **unwrapped**: a looping timeline's position keeps
 * growing across passes, and pass `k` places an action at `k × length + at`.
 * Wrapping is only for what is reported, never for what is compared.
 */

export type TimelineAction = {
  /** Where on the timeline the action sits, in the timeline's unit. */
  at: number;
  /** What leaves the timeline when time reaches `at`. */
  data?: unknown;
};

export type Extent = {
  /** How long the timeline is; 0 is unbounded, which only a non-looping one can be. */
  length: number;
  loop: boolean;
};

/**
 * The actions due after `from` up to and including `to`, earliest first, and
 * in list order where several share a moment. `includeFrom` counts `from`
 * itself as well: time that has just been set to a position, rather than
 * having travelled to it, has not yet fired what sits there.
 *
 * A looping timeline's positions are `[0, length)` — an action at `length` or
 * beyond would be the same moment as one at 0 of the next pass, so it never
 * fires. A non-looping one's are `[0, length]`.
 */
export function dueActions(
  actions: TimelineAction[],
  from: number,
  to: number,
  extent: Extent,
  includeFrom = false,
): unknown[] {
  if (to < from) {
    return [];
  }

  const inWindow = (pos: number) =>
    (includeFrom ? pos >= from : pos > from) && pos <= to;

  const due: { pos: number; index: number; data: unknown }[] = [];
  const { length, loop } = extent;

  if (loop && length > 0) {
    const firstPass = Math.max(0, Math.floor(from / length));
    const lastPass = Math.floor(to / length);
    for (let pass = firstPass; pass <= lastPass; pass++) {
      actions.forEach((action, index) => {
        if (action.at < 0 || action.at >= length) {
          return;
        }
        const pos = pass * length + action.at;
        if (inWindow(pos)) {
          due.push({ pos, index, data: action.data });
        }
      });
    }
  } else {
    actions.forEach((action, index) => {
      if (action.at < 0 || (length > 0 && action.at > length)) {
        return;
      }
      if (inWindow(action.at)) {
        due.push({ pos: action.at, index, data: action.data });
      }
    });
  }

  due.sort((a, b) => a.pos - b.pos || a.index - b.index);
  return due.map(({ data }) => (data === undefined ? null : data));
}

/**
 * The actions after `from` to the end of the pass it lies in — what a timeline
 * still owed when the time driving it went back to the start.
 */
export function restOfPass(
  actions: TimelineAction[],
  from: number,
  extent: Extent,
): unknown[] {
  const { length, loop } = extent;
  if (loop && length > 0) {
    // Read as one pass of a timeline that does not loop, whose end — the
    // next pass's start — is not part of it.
    const inPass = wrap(from, extent);
    return dueActions(
      actions.filter((a) => a.at < length),
      inPass,
      length,
      { length, loop: false },
    );
  }
  return dueActions(actions, from, length > 0 ? length : Infinity, extent);
}

/** An unwrapped position as the timeline reports it. */
export function wrap(pos: number, extent: Extent): number {
  if (extent.loop && extent.length > 0) {
    return pos - Math.floor(pos / extent.length) * extent.length;
  }
  return pos;
}

/** The actions a board wrote, keeping only those with a place on the timeline. */
export function normalizeActions(value: unknown): TimelineAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (a): a is TimelineAction =>
        !!a && typeof a === "object" && Number.isFinite(Number((a as any).at)),
    )
    .map((a) => ({ ...a, at: Number(a.at) }));
}

/** How a value travels from one keyframe to the next. */
export type Ease = "linear" | "in" | "out" | "in-out" | "step";

export type Keyframe = {
  at: number;
  value: unknown;
  /** How the value leaves this keyframe for the next; linear when not said. */
  ease?: Ease;
};

/** A property of the timeline's object, and the keyframes it passes through. */
export type Keyframes = Record<string, Keyframe[]>;

const EASINGS: Record<Ease, (p: number) => number> = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - Math.pow(1 - p, 3),
  "in-out": (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  step: () => 0,
};

const NUMBER_WITH_SUFFIX = /^(-?\d*\.?\d+)(\D*)$/;
const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/**
 * Part of the way from `from` to `to`. Numbers travel, and so do strings that
 * are a number with the same suffix at both ends ("30%" to "70%") and colours
 * written as `#rrggbb`. Anything else holds `from` until the next keyframe.
 */
export function interpolate(from: unknown, to: unknown, p: number): unknown {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * p;
  }
  if (typeof from === "string" && typeof to === "string") {
    const a = from.match(NUMBER_WITH_SUFFIX);
    const b = to.match(NUMBER_WITH_SUFFIX);
    if (a && b && a[2] === b[2]) {
      const value = Number(a[1]) + (Number(b[1]) - Number(a[1])) * p;
      return `${round(value)}${a[2]}`;
    }
    const ca = from.match(HEX_COLOR);
    const cb = to.match(HEX_COLOR);
    if (ca && cb) {
      const channels = [0, 2, 4].map((i) => {
        const x = parseInt(ca[1].slice(i, i + 2), 16);
        const y = parseInt(cb[1].slice(i, i + 2), 16);
        return Math.round(x + (y - x) * p)
          .toString(16)
          .padStart(2, "0");
      });
      return `#${channels.join("")}`;
    }
  }
  return from;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * A property's value at `t`: its first keyframe's before it, its last one's
 * after it, and in between, eased from the keyframe before `t` towards the one
 * after. Keyframes are expected in time order.
 */
export function valueAt(keyframes: Keyframe[], t: number): unknown {
  if (keyframes.length === 0) {
    return undefined;
  }
  if (t < keyframes[0].at) {
    return keyframes[0].value;
  }
  for (let i = keyframes.length - 1; i >= 0; i--) {
    const from = keyframes[i];
    if (t < from.at) {
      continue;
    }
    const to = keyframes[i + 1];
    if (!to) {
      return from.value;
    }
    const p = (t - from.at) / (to.at - from.at);
    return interpolate(from.value, to.value, EASINGS[from.ease ?? "linear"](p));
  }
  return keyframes[0].value;
}

/** Every keyframed property's value at `t`. */
export function valuesAt(keyframes: Keyframes, t: number): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [property, frames] of Object.entries(keyframes)) {
    values[property] = valueAt(frames, t);
  }
  return values;
}

/**
 * The keyframes a board wrote, keeping only those with a place on the
 * timeline, in time order — keyframes at the same moment keep their order, so
 * the later one is where the value jumps to.
 */
export function normalizeKeyframes(value: unknown): Keyframes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Keyframes = {};
  for (const [property, frames] of Object.entries(value)) {
    if (!Array.isArray(frames)) {
      continue;
    }
    const valid = frames
      .filter(
        (k): k is Keyframe =>
          !!k && typeof k === "object" && Number.isFinite(Number((k as any).at)),
      )
      .map((k) => ({
        ...k,
        at: Number(k.at),
        ...(k.ease !== undefined && !(k.ease in EASINGS) ? { ease: undefined } : {}),
      }))
      .sort((a, b) => a.at - b.at);
    if (valid.length > 0) {
      out[property] = valid;
    }
  }
  return out;
}

/** A name placed on a timeline: from `at`, for `duration`. */
export type Placement = { name: string; at: number; duration: number };

/** How far into its placement a name is, or null where it is not playing. */
export type PlacementState = { progress: number; elapsed: number } | null;

/**
 * The placements a board wrote, keeping only those with a name, a place and a
 * duration, in the order they start — so where two of a name overlap, the one
 * that started later comes later.
 */
export function normalizePlacements(value: unknown): Placement[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (p): p is Placement =>
        !!p &&
        typeof p === "object" &&
        typeof (p as any).name === "string" &&
        (p as any).name !== "" &&
        Number.isFinite(Number((p as any).at)) &&
        Number((p as any).at) >= 0 &&
        Number((p as any).duration) > 0,
    )
    .map((p) => ({ name: p.name, at: Number(p.at), duration: Number(p.duration) }))
    .sort((a, b) => a.at - b.at);
}

/**
 * Where a placement ends on the timeline. A bounded timeline cuts it at its
 * length; a looping one's positions stop just short of it, since its length is
 * the next pass's start.
 */
function endOf(placement: Placement, extent: Extent): number {
  const end = placement.at + placement.duration;
  if (extent.length <= 0) {
    return end;
  }
  if (extent.loop && end >= extent.length) {
    return extent.length - 1e-9;
  }
  return Math.min(end, extent.length);
}

/**
 * Each placement's end as an action whose data is its index — so the windows
 * that decide which actions are due decide which placements ended as well.
 */
export function placementEnds(placements: Placement[], extent: Extent): TimelineAction[] {
  return placements.map((p, index) => ({ at: endOf(p, extent), data: index }));
}

/**
 * Every name placed, and where `t` is in it: playing where `t` lies in a
 * placement of it, and null where it lies in none. A placement that `ended`
 * in the frame without `t` lying in it is reported at its end, so the last of
 * it is not skipped between frames. Where two of a name overlap, the later wins.
 */
export function placementsAt(
  placements: Placement[],
  t: number,
  extent: Extent,
  ended: number[] = [],
): Record<string, PlacementState> {
  const states: Record<string, PlacementState> = {};
  placements.forEach((p, index) => {
    const end = endOf(p, extent);
    let state: PlacementState = null;
    if (t >= p.at && t <= end) {
      state = { progress: (t - p.at) / p.duration, elapsed: t - p.at };
    } else if (ended.includes(index)) {
      state = { progress: (end - p.at) / p.duration, elapsed: end - p.at };
    }
    if (state) {
      states[p.name] = {
        progress: Math.min(1, Math.round(state.progress * 1e9) / 1e9),
        elapsed: state.elapsed,
      };
    } else if (!(p.name in states)) {
      states[p.name] = null;
    }
  });
  return states;
}
