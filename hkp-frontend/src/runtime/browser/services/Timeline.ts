/**
 * Service Documentation
 * Service ID: hookup.to/service/timeline
 * Service Name: Timeline
 * Modes: clock "own" | "input"
 * Key Config: clock, object, keyframes, actions, placements, placement, length, loop, unit, tempoSlot, fps, speed, running, play, pause, stop, seek
 * IO: in=a frame { t, placements? } (clock "input") -> out={ ...object, ...values, t, actions, placements? } every frame, null outside its stretch
 *
 * Actions placed on a time axis: when time reaches an action, the action's
 * data leaves on the output. Time is a value, not a schedule — nothing is set
 * up per action, the timeline works out what lies between the time it last
 * saw and the time it sees now. So it can be paused, sought and looped, and
 * the same time gives the same output.
 *
 * **Where time comes from** is the `clock`:
 *
 * - `"own"` — the timeline keeps time itself, emitting `fps` frames a second
 *   while it plays. Measured in seconds or in beats of the tempo held in the
 *   slot `tempoSlot` names, as Timer measures them. Input is ignored.
 * - `"input"` — the timeline is driven by the frames it is given. Without a
 *   `placement` its time is theirs: `t`, in whatever unit the driver counts.
 *   After the end of a stretch that does not loop, it emits null, so what
 *   follows it does not run.
 *
 * **Placements** arrange driven timelines on the one driving them, by name.
 * A timeline's `placements` say when each name plays and for how long; a
 * driven timeline's `placement` says which name it takes. Neither knows where
 * the other sits — the name is all they share, as two Holds share a slot — and
 * everything travels in the frame: `placements` maps every name placed to how
 * far into its placement it is (`progress`, 0 to 1, and `elapsed`), or null
 * where it is not playing. A placed timeline that does not loop is stretched
 * to its placement (its time is `progress × length`); one that loops, or is
 * unbounded, plays at its own speed for as long as the placement lasts. While
 * its name is not playing it emits null. A name that starts playing without a
 * jump enters from its start. A timeline's frames carry its own placements
 * only, so each level sees the names of the one driving it.
 *
 * **One object, animated.** A timeline can hold an `object` — an image to
 * draw, say — and `keyframes` for any of its properties: values at moments,
 * eased from one to the next. Every frame is the object with each keyframed
 * property at its value for that time, so a timeline animating a drawing
 * instruction emits a drawing instruction.
 *
 * **Every frame is emitted**, not only those an action falls in, because what
 * follows has to redraw: `{ t, actions }` on top of the object and its values,
 * with the data of every action due in that frame, earliest first and in list
 * order where several share a moment. A driven timeline with no object keeps
 * the other fields of its input instead, so a frame can carry more than time
 * down through nested timelines.
 *
 * **A jump is not a wrap.** A frame after a seek carries `jump: true`. A
 * driven timeline seeing time go backwards *without* it takes it for the
 * driver starting over — a loop, a stop and play — settles what it still owed
 * from the pass it was in and starts its own from the beginning. With it, time
 * was set rather than travelled, and only what sits exactly there fires.
 */
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import TimelineUI from "./TimelineUI";
import {
  dueActions,
  Extent,
  Keyframes,
  normalizeActions,
  normalizeKeyframes,
  normalizePlacements,
  Placement,
  placementEnds,
  placementsAt,
  PlacementState,
  restOfPass,
  TimelineAction,
  valuesAt,
  wrap,
} from "./timeline-core";

const serviceId = "hookup.to/service/timeline";
const serviceName = "Timeline";

const DEFAULT_TEMPO_BPM = 120;

type State = {
  clock: "own" | "input";
  /** What the timeline animates; its frames are this with the keyframed values. */
  object: Record<string, unknown> | null;
  keyframes: Keyframes;
  actions: TimelineAction[];
  /** In the timeline's unit; 0 is unbounded. */
  length: number;
  loop: boolean;
  /** How an own clock counts: seconds or beats. */
  unit: "s" | "beats";
  tempoSlot: string;
  /** Frames a second an own clock emits. */
  fps: number;
  /** How fast an own clock runs. */
  speed: number;
  running: boolean;
  /** When each name plays on this timeline, and for how long. */
  placements: Placement[];
  /** The name a driven timeline takes from its driver's placements; "" takes none. */
  placement: string;
};

/**
 * Whether a placed timeline's frames place it. `playing` and `waiting` are the
 * name being placed, now or at another time; `unplaced` is frames that place
 * other names but never this one — a name mistyped on one side, most likely;
 * `no-placements` is frames that place nothing at all.
 */
export type PlacementStatus = "playing" | "waiting" | "unplaced" | "no-placements";

type Config = Partial<State> & {
  play?: boolean;
  pause?: boolean;
  stop?: boolean;
  seek?: number;
};

type Frame = {
  t: number;
  actions: unknown[];
  jump?: true;
  placements?: Record<string, PlacementState>;
  [property: string]: unknown;
};

class Timeline extends ServiceBase<State> {
  /** An own clock's unwrapped position. */
  private pos = 0;
  /**
   * Whether `pos` was set rather than reached — then what sits exactly at it
   * has not fired yet.
   */
  private posIsFresh = true;
  /** The next frame of an own clock follows a seek. */
  private jumpPending = false;
  private lastTick = 0;
  /** Whether an own clock has emitted yet — before that, there is nothing on show to update. */
  private hasEmitted = false;
  private ticker: ReturnType<typeof setInterval> | undefined;

  /** A driven timeline's own time at the last input, unwrapped. */
  private prevRaw: number | null = null;
  /** The last frame a driven timeline emitted, for showing an edit on it. */
  private lastDriven: { t: number; frameIn: Record<string, unknown> } | null =
    null;
  private placementStatus: PlacementStatus | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      clock: "own",
      object: null,
      keyframes: {},
      actions: [],
      length: 0,
      loop: false,
      unit: "s",
      tempoSlot: "tempo",
      fps: 30,
      speed: 1,
      running: false,
      placements: [],
      placement: "",
    });
  }

  configure(config: Config) {
    const changed: Partial<State> = {};

    if (config.clock === "own" || config.clock === "input") {
      if (config.clock !== this.state.clock) {
        this.halt();
        this.rewind();
        this.prevRaw = null;
        this.lastDriven = null;
      }
      this.state.clock = changed.clock = config.clock;
    }

    if (config.object !== undefined) {
      const object = config.object;
      this.state.object = changed.object =
        object && typeof object === "object" && !Array.isArray(object)
          ? object
          : null;
    }

    if (config.keyframes !== undefined) {
      this.state.keyframes = changed.keyframes = normalizeKeyframes(
        config.keyframes,
      );
    }

    if (config.actions !== undefined) {
      this.state.actions = changed.actions = normalizeActions(config.actions);
    }

    if (isNumber(config.length) && config.length >= 0) {
      this.state.length = changed.length = config.length;
    }

    if (typeof config.loop === "boolean") {
      this.state.loop = changed.loop = config.loop;
    }

    if (config.unit === "s" || config.unit === "beats") {
      this.state.unit = changed.unit = config.unit;
    }

    if (typeof config.tempoSlot === "string" && config.tempoSlot) {
      this.state.tempoSlot = changed.tempoSlot = config.tempoSlot;
    }

    if (isNumber(config.fps) && config.fps > 0) {
      this.state.fps = changed.fps = config.fps;
      if (this.ticker) {
        this.startTicker();
      }
    }

    if (isNumber(config.speed)) {
      this.state.speed = changed.speed = config.speed;
    }

    if (config.placements !== undefined) {
      this.state.placements = changed.placements = normalizePlacements(
        config.placements,
      );
    }

    if (typeof config.placement === "string") {
      if (config.placement !== this.state.placement) {
        this.prevRaw = null;
        this.lastDriven = null;
        this.placementStatus = null;
      }
      this.state.placement = changed.placement = config.placement;
    }

    if (Object.keys(changed).length > 0) {
      this.app.notify(this, changed);
    }

    if (
      changed.object !== undefined ||
      changed.keyframes !== undefined ||
      changed.placements !== undefined
    ) {
      this.refresh();
    }

    if (isNumber(config.seek)) {
      this.seek(config.seek);
    }

    if (config.stop) {
      this.halt();
      this.rewind();
    } else if (config.pause || config.running === false) {
      this.halt();
    } else if (config.play || config.running === true) {
      this.play();
    }
  }

  process(input: unknown): Frame | null {
    if (this.state.clock !== "input") {
      return null;
    }

    const frameIn =
      typeof input === "object" && input !== null && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    const extent = this.extent();
    const { length, loop } = extent;

    let raw: number;
    let entering = false;
    if (this.state.placement) {
      const placed = this.placedIn(frameIn);
      if (!placed) {
        // Not playing: nothing to show, and whatever plays next starts fresh.
        this.prevRaw = null;
        this.lastDriven = null;
        return null;
      }
      raw = !loop && length > 0 ? placed.progress * length : placed.elapsed;
      entering = this.prevRaw === null;
    } else {
      raw = Number(typeof input === "number" ? input : frameIn.t);
      if (!Number.isFinite(raw)) {
        return null;
      }
    }

    const prev = this.prevRaw;
    this.prevRaw = raw;

    // What lies between the time last seen and this one — the same window for
    // the actions and for the ends of this timeline's own placements.
    const due = (list: TimelineAction[]): unknown[] => {
      if (frameIn.jump === true) {
        return dueActions(list, raw, raw, extent, true);
      }
      if (prev === null) {
        // A placement just begun enters from its start; time first seen
        // anywhere else was set, not travelled.
        return entering
          ? dueActions(list, 0, raw, extent, true)
          : dueActions(list, raw, raw, extent, true);
      }
      if (raw >= prev) {
        return dueActions(list, prev, raw, extent);
      }
      // Started over: the rest of the pass it was in, then its own start.
      return [
        ...restOfPass(list, prev, extent),
        ...dueActions(list, 0, raw, extent, true),
      ];
    };
    const actions = due(this.state.actions);
    const ended = due(placementEnds(this.state.placements, extent)) as number[];

    const outside = !loop && length > 0 && raw > length;
    if (outside && actions.length === 0 && ended.length === 0) {
      this.lastDriven = null;
      return null;
    }

    // Outside its stretch only to deliver what fell due on the way out (actions,
    // or the end of a placement), so the time reported is the edge it left by.
    const own = outside ? length : wrap(raw, extent);
    this.app.notify(this, { t: own });
    this.lastDriven = { t: own, frameIn };
    return this.frame(own, actions, frameIn, ended);
  }

  /**
   * Where this timeline's placement is in the frame it was given, or null
   * where it is not playing; says so to the panel when that changes.
   */
  private placedIn(frameIn: Record<string, unknown>): { progress: number; elapsed: number } | null {
    const all = frameIn.placements;
    const known = !!all && typeof all === "object";
    const entry = known ? (all as Record<string, PlacementState>)[this.state.placement] : undefined;
    const status: PlacementStatus = !known
      ? "no-placements"
      : entry === undefined
        ? "unplaced"
        : entry === null
          ? "waiting"
          : "playing";
    if (status !== this.placementStatus) {
      this.placementStatus = status;
      this.app.notify(this, { placementStatus: status });
    }
    return entry ?? null;
  }

  destroy() {
    this.halt();
  }

  private extent(): Extent {
    return { length: this.state.length, loop: this.state.loop };
  }

  private play() {
    if (this.state.clock !== "own" || this.ticker) {
      return;
    }
    const { length, loop } = this.state;
    if (!loop && length > 0 && this.pos >= length) {
      // Played through to its end: playing again is from the start.
      this.rewind();
    }
    this.lastTick = Date.now();
    this.startTicker();
    this.state.running = true;
    this.app.notify(this, { running: true });
    // A frame now rather than one interval from now: whatever sits at the
    // position it starts from is due as soon as it plays.
    this.emit(this.pos);
  }

  private halt() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
    if (this.state.running) {
      this.state.running = false;
      this.app.notify(this, { running: false });
    }
  }

  /**
   * Back to the start. Not a jump: a driven timeline seeing its driver start
   * over starts over itself.
   */
  private rewind() {
    this.pos = 0;
    this.posIsFresh = true;
    this.app.notify(this, { t: 0 });
  }

  /**
   * Sets an own clock's time. Playing, the next frame starts from there;
   * paused, a frame is emitted at once, so what follows shows that moment —
   * scrubbing a paused timeline scrubs everything it drives.
   */
  private seek(to: number) {
    if (this.state.clock !== "own") {
      return;
    }
    this.pos = Math.max(0, to);
    this.posIsFresh = true;
    this.jumpPending = true;
    if (this.ticker) {
      this.app.notify(this, { t: wrap(this.pos, this.extent()) });
    } else {
      this.emit(this.pos);
    }
  }

  /**
   * Emits the frame for the time the timeline is at again, after what it
   * animates has changed — so an edit shows while nothing plays. Not a step in
   * time: no action fires. A playing own clock shows it on its next frame
   * anyway, and a driven timeline outside its stretch has nothing to show.
   */
  private refresh() {
    if (this.bypass) {
      return;
    }
    if (this.state.clock === "own") {
      if (!this.ticker && this.hasEmitted) {
        this.app.next(this, this.frame(wrap(this.pos, this.extent()), [], {}));
      }
      return;
    }
    if (this.lastDriven) {
      const { t, frameIn } = this.lastDriven;
      this.app.next(this, this.frame(t, [], frameIn));
    }
  }

  private startTicker() {
    if (this.ticker) {
      clearInterval(this.ticker);
    }
    this.ticker = setInterval(() => this.tick(), 1000 / this.state.fps);
  }

  private tick() {
    const now = Date.now();
    const seconds = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const perSecond = this.state.unit === "beats" ? this.tempo() / 60 : 1;
    let to = this.pos + seconds * perSecond * this.state.speed;

    const { length, loop } = this.state;
    const ends = !loop && length > 0 && to >= length;
    if (ends) {
      to = length;
    }
    this.emit(to);
    if (ends) {
      this.halt();
    }
  }

  /** Moves an own clock to `to`, emitting the frame that takes it there. */
  private emit(to: number) {
    const extent = this.extent();
    const actions = dueActions(
      this.state.actions,
      this.pos,
      to,
      extent,
      this.posIsFresh,
    );
    const ended = dueActions(
      placementEnds(this.state.placements, extent),
      this.pos,
      to,
      extent,
      this.posIsFresh,
    ) as number[];
    this.pos = to;
    this.posIsFresh = false;
    this.hasEmitted = true;

    const frame = this.frame(wrap(to, extent), actions, {}, ended);
    if (this.jumpPending) {
      frame.jump = true;
      this.jumpPending = false;
    }
    this.app.notify(this, { t: frame.t });
    if (!this.bypass) {
      this.app.next(this, frame);
    }
  }

  /**
   * The frame for time `t`: the object with its keyframed values, or, with no
   * object, what came in. A jump is passed on either way, so a seek reaches
   * every timeline below this one. Placements are not: the frame carries this
   * timeline's own — replacing its driver's, which were meant for this level —
   * with those that `ended` in it reported at their end.
   */
  private frame(
    t: number,
    actions: unknown[],
    frameIn: Record<string, unknown>,
    ended: number[] = [],
  ): Frame {
    const base = this.state.object ?? frameIn;
    const frame: Frame = {
      ...base,
      ...valuesAt(this.state.keyframes, t),
      t,
      actions,
    };
    delete frame.placements;
    if (this.state.placements.length > 0 || "placements" in frameIn) {
      frame.placements = placementsAt(this.state.placements, t, this.extent(), ended);
    }
    if (frameIn.jump === true) {
      frame.jump = true;
    }
    return frame;
  }

  /** Beats per minute held in the tempo slot, or the default where none is. */
  private tempo(): number {
    const held = Number(this.app.slots?.()?.get(this.state.tempoSlot));
    return Number.isFinite(held) && held > 0 ? held : DEFAULT_TEMPO_BPM;
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new Timeline(app, board, descriptor, id),
  createUI: TimelineUI,
};
