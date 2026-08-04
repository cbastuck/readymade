import { useState, type ReactNode } from "react";

import { M } from "../../playground/mobile/tokens";
import { RuntimeNode, RuntimeServiceInfo } from "../types";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: M.textMuted,
        padding: "0 4px",
      }}
    >
      {children}
    </div>
  );
}

/** One labelled metadata row (Server / Board / Runtime id). */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "0 4px" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: M.textMuted,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: M.textSecondary,
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** A service row, expandable to the JSON state the server last reported. */
function ServiceRow({
  service,
  first,
}: {
  service: RuntimeServiceInfo;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasState =
    service.state !== undefined &&
    service.state !== null &&
    !(
      typeof service.state === "object" &&
      Object.keys(service.state as object).length === 0
    );

  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${M.border}` }}>
      <div
        onClick={() => hasState && setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          cursor: hasState ? "pointer" : "default",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: M.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.serviceName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: M.textMuted,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {service.serviceId}
          </div>
        </div>
        {hasState && (
          <span style={{ fontSize: 13, color: M.textMuted, flexShrink: 0 }}>
            {open ? "Hide" : "State"}
          </span>
        )}
      </div>
      {open && hasState && (
        <pre
          style={{
            margin: "0 14px 12px",
            padding: "10px 12px",
            background: M.bg,
            borderRadius: 10,
            fontSize: 11,
            lineHeight: 1.5,
            color: M.textSecondary,
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {JSON.stringify(service.state, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Runtime details as a pushed page: the server hosting it, the board it was
 * created for, its id, and the services it hosts with the state the server
 * last reported — a snapshot, taken when the source last listed it.
 *
 * The mobile counterpart of the desktop RuntimeDetails column. `onOpen` is set
 * only by hosts that have a view to watch the runtime live.
 */
export default function MobileRuntimeDetails({
  runtime,
  onOpen,
}: {
  runtime: RuntimeNode;
  onOpen?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 20,
            background: "linear-gradient(160deg, #17b877, #0a8a72)",
          }}
        />
        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: M.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {runtime.name}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              fontSize: 12,
              fontWeight: 600,
              color: M.textSecondary,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#17b877",
              }}
            />
            Running on {runtime.remoteName}
          </div>
        </div>
      </div>

      {onOpen && (
        <button
          onClick={onOpen}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            borderRadius: 12,
            border: "none",
            background: M.teal,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Open runtime
        </button>
      )}

      {runtime.onRefresh && (
        <button
          onClick={runtime.onRefresh}
          disabled={runtime.refreshing}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            borderRadius: 12,
            border: `1px solid ${M.border}`,
            background: M.card,
            color: M.textPrimary,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: runtime.refreshing ? "default" : "pointer",
            opacity: runtime.refreshing ? 0.6 : 1,
          }}
        >
          {runtime.refreshing ? "Refreshing…" : "Refresh"}
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MetaRow label="Server" value={runtime.remoteUrl} />
        <MetaRow label="Board" value={runtime.boardName || "—"} />
        <MetaRow label="Runtime id" value={runtime.id} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionLabel>Services ({runtime.services.length})</SectionLabel>
        {runtime.services.length === 0 ? (
          <div style={{ fontSize: 13, color: M.textMuted, padding: "0 4px" }}>
            No services on this runtime.
          </div>
        ) : (
          <div
            style={{
              background: M.card,
              border: `1px solid ${M.border}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {runtime.services.map((service, index) => (
              <ServiceRow
                key={service.uuid}
                service={service}
                first={index === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
