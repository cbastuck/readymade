/**
 * What is known about one node, while the overview is being read.
 *
 * The scene says where a service is and whether it is running; this says what
 * it is — which runtime holds it, what it is nested in, what it was configured
 * with, and what its last call did. It is the half of an overview that a
 * picture cannot carry, and the reason clicking a node stopped meaning "go
 * there": going there is now one of the things offered here, rather than the
 * only thing a click could do.
 */
import { CornerUpRight } from "lucide-react";

import { NodeActivity, Payload } from "./activity";
import { OverviewNode, OverviewScene } from "./graph";
import { Palette } from "./render";

type Props = {
  node: OverviewNode;
  scene: OverviewScene;
  runtimeLabel: string;
  activity?: NodeActivity;
  /** Whether a call was in flight when this was last sampled. */
  processing: boolean;
  /** Now, as the tracker counts it, for saying how long ago data crossed. */
  now: number;
  palette: Palette;
  onOpenInPlayground: () => void;
  onClose: () => void;
};

function Row({
  label,
  children,
  palette,
}: {
  label: string;
  children: React.ReactNode;
  palette: Palette;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span
        style={{
          color: palette.textMuted,
          flexShrink: 0,
          width: 74,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </span>
      <span
        style={{ color: palette.text, minWidth: 0, wordBreak: "break-word" }}
      >
        {children}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: Palette;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        borderBottom: `1px solid ${palette.cardBorder}`,
      }}
    >
      <div
        style={{
          color: palette.textMuted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** How long ago something crossed, in the coarsest unit that still says it. */
function ago(at: number, now: number): string {
  // Floored, not rounded: half a second having passed is not a second ago.
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 1) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  return `${Math.floor(seconds / 60)}m ago`;
}

function PayloadView({
  payload,
  now,
  palette,
  empty,
  note,
}: {
  payload?: Payload;
  now: number;
  palette: Palette;
  empty: string;
  note?: string;
}) {
  if (!payload) {
    return <span style={{ color: palette.textMuted }}>{empty}</span>;
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, color: palette.textMuted }}>
        <span>{payload.summary}</span>
        <span style={{ marginLeft: "auto" }}>{ago(payload.at, now)}</span>
      </div>
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: palette.text,
        }}
      >
        {payload.preview}
      </pre>
      {note && <span style={{ color: palette.textMuted }}>{note}</span>}
    </>
  );
}

export default function OverviewDetails({
  node,
  scene,
  runtimeLabel,
  activity,
  processing,
  now,
  palette,
  onOpenInPlayground,
  onClose,
}: Props) {
  // Where this sits, named the way the board names it rather than by uuid.
  const path = [
    ...node.ancestry.map((uuid) => scene.byUuid.get(uuid)?.label ?? uuid),
    node.label,
  ];

  const configuration = (() => {
    if (node.state === undefined || node.state === null) {
      return null;
    }
    try {
      // A sub-service's pipeline is the nesting the scene already draws, and
      // is long enough to bury everything else here.
      const { pipeline, ...rest } = node.state as Record<string, unknown>;
      void pipeline;
      const text = JSON.stringify(rest, null, 2);
      return text === "{}" ? null : text;
    } catch {
      return null;
    }
  })();

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: `1px solid ${palette.cardBorder}`,
        background: palette.card,
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.55,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `1px solid ${palette.cardBorder}`,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: palette.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.label}
        </span>
        {processing && (
          <span
            title="A call is in flight"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: palette.accent,
              flexShrink: 0,
            }}
          />
        )}
        <button
          onClick={onClose}
          aria-label="Close details"
          style={{
            marginLeft: "auto",
            border: "none",
            background: "none",
            color: palette.textMuted,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 14,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        <Section title="Service" palette={palette}>
          <Row label="Id" palette={palette}>
            {node.serviceId || "—"}
          </Row>
          <Row label="Uuid" palette={palette}>
            {node.uuid}
          </Row>
          <Row label="Bypassed" palette={palette}>
            {node.bypassed ? "yes" : "no"}
          </Row>
        </Section>

        <Section title="Where" palette={palette}>
          <Row label="Runtime" palette={palette}>
            {runtimeLabel}
          </Row>
          <Row label="Level" palette={palette}>
            {node.depth === 0 ? "top level" : `nested ${node.depth} deep`}
          </Row>
          <Row label="Position" palette={palette}>
            {`#${node.index + 1} in its pipeline`}
          </Row>
          {node.ancestry.length > 0 && (
            <Row label="Path" palette={palette}>
              {path.join(" / ")}
            </Row>
          )}
        </Section>

        <Section title="Activity" palette={palette}>
          <Row label="Calls" palette={palette}>
            {activity?.calls ?? 0}
            {activity?.calls ? "" : " — nothing since this view opened"}
          </Row>
        </Section>

        <Section title="Last in" palette={palette}>
          <PayloadView
            payload={activity?.lastIn}
            now={now}
            palette={palette}
            empty="Nothing has been handed to this service yet."
          />
        </Section>

        <Section title="Last out" palette={palette}>
          <PayloadView
            payload={activity?.lastOut}
            now={now}
            palette={palette}
            empty="This service has not answered yet."
            note={
              activity?.lastStopped
                ? "Nothing was passed on — the pipeline stopped here."
                : undefined
            }
          />
        </Section>

        {configuration && (
          <Section title="Configuration" palette={palette}>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: palette.text,
              }}
            >
              {configuration}
            </pre>
          </Section>
        )}
      </div>

      <div style={{ padding: 12, flexShrink: 0 }}>
        <button
          onClick={onOpenInPlayground}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 7,
            border: `1px solid ${palette.accent}`,
            background: "transparent",
            color: palette.text,
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 11,
          }}
        >
          <CornerUpRight size={14} strokeWidth={1.5} />
          open in playground
        </button>
      </div>
    </div>
  );
}
