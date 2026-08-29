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
};

export function defaultPalette(accent: string): Palette {
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
  };
}

/** Where a node ended up on screen, so a click can be matched back to it. */
export type HitTarget = {
  uuid: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

type Drawable = { depth: number; draw: () => void };

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
  hoveredUuid?: string | null;
};

export function render(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions,
): HitTarget[] {
  const { scene, camera, viewport, activity, palette, now, hoveredUuid } =
    options;

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
      projected.set(node.uuid, point);
    }
  }

  // Which services sit directly on which runtime, worked out once rather than
  // per runtime per frame.
  const topLevelByRuntime = new Map<string, typeof scene.nodes>();
  for (const node of scene.nodes) {
    if (node.depth !== 0) {
      continue;
    }
    const column = topLevelByRuntime.get(node.runtimeId) ?? [];
    column.push(node);
    topLevelByRuntime.set(node.runtimeId, column);
  }

  const cardRgb = parseHex(palette.card);
  const cardHotRgb = parseHex(palette.cardHot);
  const drawables: Drawable[] = [];
  const hits: HitTarget[] = [];

  // ── runtime labels and their spines ──────────────────────────────────────
  for (const runtime of scene.runtimes) {
    const head = project(camera, runtime, viewport);
    if (!head) {
      continue;
    }
    const column = topLevelByRuntime.get(runtime.id) ?? [];
    const tail = column.length
      ? projected.get(column[column.length - 1].uuid)
      : undefined;

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
    const point = projected.get(node.uuid);
    if (!point) {
      continue;
    }
    const width = NODE_WIDTH * point.scale;
    const height = NODE_HEIGHT * point.scale;
    const left = point.x - width / 2;
    const top = point.y - height / 2;

    hits.push({
      uuid: node.uuid,
      x: left,
      y: top,
      width,
      height,
      depth: point.depth,
    });

    const state = activity.get(node.uuid);
    // Fully lit while the call is in flight, fading back over the cooldown.
    const heat = state
      ? state.startedAt !== undefined
        ? 1
        : Math.max(0, (state.litUntil - now) / COOLDOWN_MS)
      : 0;
    const hovered = hoveredUuid === node.uuid;

    drawables.push({
      depth: point.depth,
      draw: () => {
        ctx.save();
        // What is further back is dimmer. Every card faces the camera, so
        // without this a nested level reads as another row of the pipeline
        // rather than as something standing behind it.
        const fade = Math.max(0.4, Math.min(1, point.scale * 1.7));
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

        ctx.strokeStyle =
          heat > 0 || hovered ? palette.accent : palette.cardBorder;
        ctx.lineWidth = hovered ? 2 : 1;
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
            const detail = state?.lastResult
              ? `${state.calls} · ${state.lastResult}`
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
