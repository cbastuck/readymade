/**
 * Drawing the scene.
 *
 * Everything is drawn back to front — edges and nodes go into one list ordered
 * by how far away they are and are painted in that order, which is enough
 * occlusion for a lattice of cards that all face the camera. Cards are
 * billboarded rather than oriented in space: an overview is read by its labels,
 * and a label that turns away from the camera stops being one.
 *
 * Detail is dropped as things recede — a card too small to hold text is drawn
 * as a plain marker — so a board seen from far out stays legible instead of
 * turning into overlapping type.
 */
import { Camera, Viewport, project } from "./camera";
import { ActivityTracker, COOLDOWN_MS, PULSE_MS } from "./activity";
import { OverviewScene } from "./graph";

/** Card size in world units, before perspective. */
const NODE_WIDTH = 210;
const NODE_HEIGHT = 58;
/** How far a ground extends past the cards standing on it. */
const GROUND_PADDING = 26;
/** Room kept above a runtime's head point for the name written there. */
const GROUND_HEADROOM = 34;
/** How far a ground's edge is taken towards the text colour, to draw its line. */
const GROUND_EDGE = 0.14;
/** How far the corners of a runtime's field are rounded off, in world units. */
const GROUND_ROUNDING = 22;
/** The same for a scope drawn on it, kept tighter than the field around it. */
const SCOPE_ROUNDING = 14;
/**
 * How big the name of a pipeline is written on the scope holding it.
 *
 * It goes in the padding a scope already has above its first card rather than
 * in room of its own: two pipelines of one host are a row apart, and a scope
 * given its own headroom is taller than a row — the second's name would be
 * written under the first's ground.
 */
const SCOPE_CAPTION = 12;
/** How far that name is taken towards the text colour, to be read on it. */
const GROUND_CAPTION_INK = 0.55;

export type Palette = {
  background: string;
  card: string;
  /** What a card becomes while it is being called. */
  cardHot: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  edge: string;
  accent: string;
  /**
   * What a runtime naming no colour of its own stands on: the same appearance
   * default the playground fills its container with, so a board that was never
   * coloured by hand looks here as it does there.
   */
  runtimeGround: string;
};

export function defaultPalette(
  accent: string,
  runtimeGround = "#ffffff",
): Palette {
  return {
    background: "#f4f2ef",
    card: "#ffffff",
    // A tint rather than the accent itself: the label stays on the card while
    // it is lit, and dark text on full accent is the wrong side of readable.
    // What actually says "running" is the border and the glow around it.
    cardHot: tint(accent, "#ffffff", 0.72),
    cardBorder: "#d8d2ca",
    text: "#22262b",
    textMuted: "rgba(34, 38, 43, 0.5)",
    edge: "rgba(34, 38, 43, 0.22)",
    accent,
    runtimeGround,
  };
}

/** Where a node ended up on screen, so a click can be matched back to it. */
export type HitTarget = {
  /** The node's key; see OverviewNode.key. */
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

type Drawable = { depth: number; draw: () => void };

/**
 * A colour a board or a theme wrote, as channels the mixing below can work on.
 *
 * What arrives here is whatever was authored: the runtime picker writes hex, a
 * board written by hand says `black` or `#333`, and a theme names a token with
 * a fallback behind it — `var(--bg-runtime, oklch(…))`. Anything past plain hex
 * is therefore read in two steps, because neither alone covers it: a hidden
 * element in the document resolves the cascade, which is the only place a
 * custom property means anything, and a canvas pixel then resolves the colour
 * space, which is where `oklch` stops being a string a browser hands back
 * unchanged. A value the cascade does not recognise comes back transparent,
 * and is read as no colour at all.
 *
 * Answers are kept, since a board's runtimes are few and their colours are
 * read on every frame.
 */
const readColours = new Map<string, [number, number, number] | null>();
let colourProbe: CanvasRenderingContext2D | null | undefined;
let cascadeProbe: HTMLElement | null | undefined;

function readColour(colour: string): [number, number, number] | null {
  const cached = readColours.get(colour);
  if (cached !== undefined) {
    return cached;
  }
  const resolved = resolveColour(colour);
  readColours.set(colour, resolved);
  return resolved;
}

function resolveColour(colour: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1].replace(/./g, (digit) => digit + digit)
        : hex[1];
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  if (typeof document === "undefined") {
    return null;
  }
  if (cascadeProbe === undefined) {
    cascadeProbe = document.createElement("div");
    cascadeProbe.style.display = "none";
    document.body.appendChild(cascadeProbe);
  }
  if (colourProbe === undefined) {
    colourProbe = document.createElement("canvas").getContext("2d");
  }
  if (!cascadeProbe || !colourProbe) {
    return null;
  }

  // Set twice: what the cascade rejects leaves the first value standing, and
  // a transparent one is how an unusable colour is told from a real one.
  cascadeProbe.style.color = "rgba(0, 0, 0, 0)";
  cascadeProbe.style.color = colour;
  const cascaded = getComputedStyle(cascadeProbe).color;

  colourProbe.clearRect(0, 0, 1, 1);
  colourProbe.fillStyle = "rgba(0, 0, 0, 0)";
  colourProbe.fillStyle = cascaded;
  colourProbe.fillRect(0, 0, 1, 1);
  const [r, g, b, alpha] = colourProbe.getImageData(0, 0, 1, 1).data;
  return alpha === 0 ? null : [r, g, b];
}

function parseHex(colour: string): [number, number, number] {
  const hex = colour.trim().replace("#", "");
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return [10, 188, 251];
}

/** Moves a colour towards another by a fraction, as a hex string. */
function tint(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = Math.max(0, Math.min(1, amount));
  const channel = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function mix(
  from: [number, number, number],
  to: [number, number, number],
  amount: number,
): string {
  const t = Math.max(0, Math.min(1, amount));
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * The outline around a set of screen-space points, counter-clockwise.
 *
 * Andrew's monotone chain: sort, then walk the points keeping only the turns
 * that go one way. What it is given is the corners of every card in a runtime,
 * so what comes back is the smallest shape holding all of them whatever angle
 * the board is being looked at from.
 */
function hull(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) {
    return points;
  }
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const half = (order: typeof sorted) => {
    const line: typeof sorted = [];
    for (const point of order) {
      while (
        line.length >= 2 &&
        cross(line[line.length - 2], line[line.length - 1], point) <= 0
      ) {
        line.pop();
      }
      line.push(point);
    }
    line.pop();
    return line;
  };

  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * Traces a polygon with its corners rounded off, as one path.
 *
 * One path rather than a fill and a fattened stroke standing in for a radius:
 * a ground is painted with the level behind it still showing through, and
 * anything drawn twice would show as a band of double the colour where the two
 * passes overlap.
 */
function roundedPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  radius: number,
) {
  if (points.length < 3) {
    return;
  }
  const towards = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    by: number,
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    // Never past the middle of a side, or a short one would be cut twice.
    const step = Math.min(by, length / 2);
    return {
      x: from.x + (dx / length) * step,
      y: from.y + (dy / length) * step,
    };
  };

  ctx.beginPath();
  for (let i = 0; i < points.length; i += 1) {
    const corner = points[i];
    const before = points[(i - 1 + points.length) % points.length];
    const after = points[(i + 1) % points.length];
    const enter = towards(corner, before, radius);
    const leave = towards(corner, after, radius);
    if (i === 0) {
      ctx.moveTo(enter.x, enter.y);
    } else {
      ctx.lineTo(enter.x, enter.y);
    }
    ctx.quadraticCurveTo(corner.x, corner.y, leave.x, leave.y);
  }
  ctx.closePath();
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

export type RenderOptions = {
  scene: OverviewScene;
  camera: Camera;
  viewport: Viewport;
  activity: ActivityTracker;
  palette: Palette;
  now: number;
  hoveredKey?: string | null;
  selectedKey?: string | null;
};

export function render(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions,
): HitTarget[] {
  const {
    scene,
    camera,
    viewport,
    activity,
    palette,
    now,
    hoveredKey,
    selectedKey,
  } = options;

  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const projected = new Map<
    string,
    { x: number; y: number; depth: number; scale: number }
  >();
  for (const node of scene.nodes) {
    const point = project(camera, node, viewport);
    if (point) {
      projected.set(node.key, point);
    }
  }

  // Which services sit directly on which runtime, worked out once rather than
  // per runtime per frame.
  const topLevelByRuntime = new Map<string, typeof scene.nodes>();
  // Every pipeline on the board, its own services in order: the one a runtime
  // holds, and one more for each pipeline a service holds. Each is a place
  // services stand in, and gets a ground of its own, because a sub-pipeline is
  // a container in the playground rather than a run of the list around it.
  // Keyed by the host *and* the name it files that pipeline under, since a
  // host can hold several — an endpoint's `onProcess` and `onRequest` are two
  // runs, and one outline around both would say they were one.
  const pipelines = new Map<string, typeof scene.nodes>();
  for (const node of scene.nodes) {
    const key = `${node.runtimeId}::${node.parent ?? ""}::${node.pipeline ?? ""}`;
    const pipeline = pipelines.get(key) ?? [];
    pipeline.push(node);
    pipelines.set(key, pipeline);

    if (node.depth !== 0) {
      continue;
    }
    const column = topLevelByRuntime.get(node.runtimeId) ?? [];
    column.push(node);
    topLevelByRuntime.set(node.runtimeId, column);
  }

  const cardRgb = parseHex(palette.card);
  const cardHotRgb = parseHex(palette.cardHot);
  const textRgb = parseHex(palette.text);
  const drawables: Drawable[] = [];
  const hits: HitTarget[] = [];

  type Station = { x: number; y: number; depth: number; scale: number };

  /** The padded corners of the cards standing on a surface. */
  const cornersOf = (cards: Station[]) =>
    cards.flatMap((card) => {
      const halfWidth = (NODE_WIDTH / 2 + GROUND_PADDING) * card.scale;
      const halfHeight = (NODE_HEIGHT / 2 + GROUND_PADDING) * card.scale;
      return [
        { x: card.x - halfWidth, y: card.y - halfHeight },
        { x: card.x + halfWidth, y: card.y - halfHeight },
        { x: card.x - halfWidth, y: card.y + halfHeight },
        { x: card.x + halfWidth, y: card.y + halfHeight },
      ];
    });

  /** Just behind the last of its own cards, and in front of anything deeper. */
  const behindOwn = (cards: Station[]) =>
    cards.reduce((deepest, card) => Math.max(deepest, card.depth), 0) + 0.5;

  /**
   * A surface holding a set of cards, in the colour of the runtime they run in.
   *
   * Drawn as the hull of what stands on it rather than as a column, because
   * nesting puts a level behind the one above it: the moment the camera is
   * turned, a host and the pipeline it holds stop being above and below each
   * other on screen, and anything shaped like a column becomes a funnel. Built
   * in screen space for the same reason the cards are billboarded — a quad
   * placed in the world would stop lining up with them once orbited.
   *
   * Opaque, and in the same order as everything else, one level at a time: a
   * ground and the cards standing on it are one thing, and what is behind that
   * is behind it. A level nearer the camera therefore hides what it covers,
   * the way anything in front of anything else does — which is the point.
   * Turning the board is what looks past it, and at most angles the levels
   * stand beside one another rather than in front.
   */
  const surface = (
    corners: Array<{ x: number; y: number }>,
    colour: [number, number, number],
    rounding: number,
    filled = true,
  ) => {
    const outline = hull(corners);
    return () => {
      ctx.save();
      roundedPath(ctx, outline, rounding);
      if (filled) {
        ctx.fillStyle = `rgb(${Math.round(colour[0])}, ${Math.round(
          colour[1],
        )}, ${Math.round(colour[2])})`;
        ctx.fill();
      }
      ctx.strokeStyle = mix(colour, textRgb, GROUND_EDGE);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };
  };

  /**
   * The outline a whole runtime covers: its own services and every scope
   * nested inside them, as one shape.
   *
   * Scoping a pipeline puts it behind the service hosting it, not somewhere
   * else — it still runs in the runtime that service sits in — so what says
   * which runtime a service belongs to has to hold all of them at once. An
   * outline rather than a ground, because the ground at the front of a runtime
   * is the one its own pipeline stands on: a second surface over the same
   * level would only be the same colour laid on twice.
   */
  const field = (
    cards: Station[],
    head: Station,
    colour: [number, number, number],
  ) => {
    // The head is a name rather than a card, and the outline has to reach over
    // it: a runtime holding no services is that name and nothing else.
    const headWidth = (NODE_WIDTH / 2 + GROUND_PADDING) * head.scale;
    const headTop = head.y - (GROUND_HEADROOM + GROUND_PADDING) * head.scale;
    const headBottom = head.y + GROUND_PADDING * head.scale;
    return surface(
      [
        ...cornersOf(cards),
        { x: head.x - headWidth, y: headTop },
        { x: head.x + headWidth, y: headTop },
        { x: head.x - headWidth, y: headBottom },
        { x: head.x + headWidth, y: headBottom },
      ],
      colour,
      GROUND_ROUNDING * head.scale,
      false,
    );
  };

  /**
   * The ground one pipeline stands on, in the colour of the runtime it runs in.
   *
   * The service hosting it is outside it, for a reason that only shows on a
   * host holding more than one — an endpoint's `onProcess` and `onRequest`, a
   * Tracks' tracks. Each would have to wrap that same card, so each would have
   * to overlap all the others there, and no order of drawing makes overlapping
   * grounds read as anything but a smear. Which host a scope belongs to is
   * said by the line drawn from it instead, and *which of that host's* is
   * written on the scope, since the line cannot say that. The host is still
   * wanted here for that writing: it is a layer nearer and lands over one side
   * of the scope or the other depending on where the camera is, and the name
   * goes on the side it is not, where a card cannot come down over it.
   */
  const scope = (
    pipeline: Station[],
    name: string | undefined,
    host: Station | undefined,
    colour: [number, number, number],
  ) => {
    const first = pipeline[0];
    const halfWidth = (NODE_WIDTH / 2 + GROUND_PADDING) * first.scale;
    // A pipeline is named where the name tells it from another of the same
    // host's. `pipeline` is what a service with only one calls it, which the
    // outline has already said, so that one is left unwritten.
    const caption = name && name !== "pipeline" ? name : null;

    const drawn = surface(
      cornersOf(pipeline),
      colour,
      SCOPE_ROUNDING * first.scale,
    );
    if (!caption) {
      return drawn;
    }

    return () => {
      drawn();
      const size = SCOPE_CAPTION * first.scale;
      // Small enough to be a texture rather than a word is worse than
      // nothing: the outline still says a scope is there.
      if (size < 6.5) {
        return;
      }
      const awayFromHost = host && host.x < first.x ? "right" : "left";
      ctx.save();
      ctx.font = `${size}px ui-monospace, SFMono-Regular, monospace`;
      ctx.fillStyle = mix(colour, textRgb, GROUND_CAPTION_INK);
      ctx.textAlign = awayFromHost;
      ctx.textBaseline = "bottom";
      ctx.fillText(
        truncate(ctx, caption, halfWidth * 2 - 12 * first.scale),
        awayFromHost === "right"
          ? first.x + halfWidth - 6 * first.scale
          : first.x - halfWidth + 6 * first.scale,
        // Just clear of the card, in the ground's own padding above it.
        first.y - (NODE_HEIGHT / 2 + 5) * first.scale,
      );
      ctx.restore();
    };
  };

  // ── runtime backdrops, labels and spines ─────────────────────────────────
  for (const runtime of scene.runtimes) {
    const head = project(camera, runtime, viewport);
    if (!head) {
      continue;
    }
    const column = topLevelByRuntime.get(runtime.id) ?? [];
    const tail = column.length
      ? projected.get(column[column.length - 1].key)
      : undefined;

    // The colour the board gave the runtime, or the appearance default it left
    // in place, as the ground its services stand on — what the playground
    // fills the container holding them with. A ground for each pipeline the
    // runtime holds, the one it holds itself included, and the runtime's own
    // outline around the lot.
    const colour =
      (runtime.color ? readColour(runtime.color) : null) ??
      readColour(palette.runtimeGround);
    if (colour) {
      const points = (nodes: typeof scene.nodes) =>
        nodes
          .map((node) => projected.get(node.key))
          .filter((point): point is Station => !!point);

      const held = [...pipelines].filter(([key]) =>
        key.startsWith(`${runtime.id}::`),
      );
      const inRuntime = points(
        scene.nodes.filter((node) => node.runtimeId === runtime.id),
      );

      drawables.push({
        // Behind the whole runtime: it says where the runtime reaches, and
        // nothing in it should be read through its line.
        depth: behindOwn(inRuntime) + 1,
        draw: field(inRuntime, head, colour),
      });

      for (const [, pipeline] of held) {
        const stations = points(pipeline);
        if (stations.length === 0) {
          continue;
        }
        drawables.push({
          // With its own services rather than under the whole board: a ground
          // and the cards standing on it are one level, and putting every
          // ground behind every card is what had a nested service drawn over
          // the runtime its host sits in.
          depth: behindOwn(stations),
          draw: scope(
            stations,
            pipeline[0].pipeline,
            pipeline[0].parent ? projected.get(pipeline[0].parent) : undefined,
            colour,
          ),
        });
      }
    }

    drawables.push({
      // Behind everything in its column, so a card is never hidden by the
      // line running through the runtime it belongs to.
      depth: head.depth + 1,
      draw: () => {
        if (tail) {
          ctx.strokeStyle = palette.edge;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(head.x, head.y);
          ctx.lineTo(tail.x, tail.y);
          ctx.stroke();
        }
        const size = Math.max(9, Math.min(22, 16 * head.scale));
        ctx.fillStyle = palette.text;
        ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(runtime.label, head.x, head.y - 6);
        if (size > 11) {
          ctx.fillStyle = palette.textMuted;
          ctx.font = `${size * 0.7}px ui-monospace, SFMono-Regular, monospace`;
          ctx.fillText(runtime.type, head.x, head.y + size * 0.85);
        }
      },
    });
  }

  // ── edges ────────────────────────────────────────────────────────────────
  for (const edge of scene.edges) {
    const from = projected.get(edge.from);
    const to = projected.get(edge.to);
    if (!from || !to) {
      continue;
    }
    drawables.push({
      depth: (from.depth + to.depth) / 2,
      draw: () => {
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = edge.kind === "handoff" ? 1.6 : 1;
        // Containment is drawn dashed: it says where a pipeline lives rather
        // than that data passed from one service to the next.
        ctx.setLineDash(edge.kind === "contains" ? [4, 5] : []);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
      },
    });
  }

  // ── pulses ───────────────────────────────────────────────────────────────
  for (const pulse of activity.livePulses(now)) {
    const from = projected.get(pulse.from);
    const to = projected.get(pulse.to);
    if (!from || !to) {
      continue;
    }
    const t = (now - pulse.startedAt) / PULSE_MS;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const depth = from.depth + (to.depth - from.depth) * t;
    const radius = Math.max(1.5, 5 * (camera.focal / depth));
    drawables.push({
      depth,
      draw: () => {
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, t)) * 0.9 + 0.1;
        ctx.fillStyle = palette.accent;
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = radius * 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
  }

  // ── nodes ────────────────────────────────────────────────────────────────
  for (const node of scene.nodes) {
    const point = projected.get(node.key);
    if (!point) {
      continue;
    }
    const width = NODE_WIDTH * point.scale;
    const height = NODE_HEIGHT * point.scale;
    const left = point.x - width / 2;
    const top = point.y - height / 2;

    hits.push({
      key: node.key,
      x: left,
      y: top,
      width,
      height,
      depth: point.depth,
    });

    const state = activity.get(node.key);
    // Fully lit while the call is in flight, fading back over the cooldown.
    const heat = state
      ? state.startedAt !== undefined
        ? 1
        : Math.max(0, (state.litUntil - now) / COOLDOWN_MS)
      : 0;
    const hovered = hoveredKey === node.key;
    const selected = selectedKey === node.key;

    drawables.push({
      depth: point.depth,
      draw: () => {
        ctx.save();
        // What is further back is dimmer. Every card faces the camera, so
        // without this a nested level reads as another row of the pipeline
        // rather than as something standing behind it.
        const fade = selected
          ? 1
          : Math.max(0.4, Math.min(1, point.scale * 1.7));
        ctx.globalAlpha = node.bypassed ? fade * 0.4 : fade;

        if (heat > 0) {
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = 30 * heat * Math.min(1, point.scale + 0.3);
        } else {
          // Cards are lighter than the ground they stand on, so what separates
          // one from it is the shadow underneath rather than its own fill.
          ctx.shadowColor = "rgba(34, 38, 43, 0.16)";
          ctx.shadowBlur = 8 * point.scale;
          ctx.shadowOffsetY = 2 * point.scale;
        }
        ctx.fillStyle = mix(cardRgb, cardHotRgb, heat);
        roundedRect(ctx, left, top, width, height, 6 * point.scale + 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // What is selected is being read about on the side, so it is marked
        // more firmly than what the pointer merely happens to be over.
        ctx.strokeStyle =
          selected || hovered || heat > 0 ? palette.accent : palette.cardBorder;
        ctx.lineWidth = selected ? 2.5 : hovered ? 2 : 1;
        ctx.setLineDash(node.bypassed ? [3, 3] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // A card too small to hold a name is left as the marker it has become.
        const nameSize = 13 * point.scale;
        if (nameSize >= 7) {
          ctx.font = `600 ${nameSize}px ui-monospace, SFMono-Regular, monospace`;
          ctx.fillStyle = palette.text;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const padding = 8 * point.scale;
          const inner = width - padding * 2;
          const detailSize = nameSize * 0.72;
          const showDetail = detailSize >= 6.5;
          ctx.fillText(
            truncate(ctx, node.label, inner),
            left + padding,
            showDetail ? point.y - height * 0.14 : point.y,
          );
          if (showDetail) {
            ctx.font = `${detailSize}px ui-monospace, SFMono-Regular, monospace`;
            ctx.fillStyle = palette.textMuted;
            const detail = state?.lastOut
              ? `${state.calls} · ${state.lastOut.summary}`
              : node.serviceId.split("/").pop() || "";
            ctx.fillText(
              truncate(ctx, detail, inner),
              left + padding,
              point.y + height * 0.24,
            );
          }
        }

        ctx.restore();
      },
    });
  }

  drawables.sort((a, b) => b.depth - a.depth);
  for (const drawable of drawables) {
    drawable.draw();
  }
  ctx.restore();

  return hits;
}

/** The nearest node under a point, or null. */
export function hitTest(
  hits: HitTarget[],
  x: number,
  y: number,
): HitTarget | null {
  let best: HitTarget | null = null;
  for (const hit of hits) {
    if (
      x >= hit.x &&
      x <= hit.x + hit.width &&
      y >= hit.y &&
      y <= hit.y + hit.height &&
      (best === null || hit.depth < best.depth)
    ) {
      best = hit;
    }
  }
  return best;
}
