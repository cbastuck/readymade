import { useState } from "react";

import { RuntimeNode, RuntimeServiceInfo } from "./types";

/** One labelled metadata row (Server / Board / Runtime id). */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--st-mut)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#4a4f5e",
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** A collapsible service row: name + id, expandable to its JSON state. */
function ServiceRow({ service }: { service: RuntimeServiceInfo }) {
  const [open, setOpen] = useState(false);
  const hasState =
    service.state !== undefined &&
    service.state !== null &&
    !(typeof service.state === "object" &&
      Object.keys(service.state as object).length === 0);

  return (
    <div
      style={{
        borderTop: "1px solid #eceef3",
        padding: "8px 2px",
      }}
    >
      <div
        className="st-row"
        style={{ padding: "2px 4px", cursor: hasState ? "pointer" : "default" }}
        onClick={() => hasState && setOpen((v) => !v)}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {service.serviceName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#9a9fae",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {service.serviceId}
          </div>
        </div>
        {hasState && (
          <span style={{ color: "#b9bdc9", fontSize: 15, fontWeight: 600 }}>
            {open ? "⌄" : "‹"}
          </span>
        )}
      </div>
      {open && hasState && (
        <pre
          style={{
            margin: "6px 4px 0",
            padding: "8px 10px",
            background: "#f4f5f7",
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            color: "#4a4f5e",
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
 * Read-only details column for a runtime running on a remote server: its
 * server, the board it was created for, its id, and the services it hosts with
 * their current state. Observation only — the live inspector and per-service
 * configuration are a later step.
 */
export default function RuntimeDetails({ runtime }: { runtime: RuntimeNode }) {
  return (
    <div
      style={{
        flex: "0 0 300px",
        width: 300,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "13px 14px 11px",
          borderBottom: "1px solid #eceef3",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--st-mut)",
          }}
        >
          Runtime
        </span>
      </div>

      <div
        className="st-v"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            background: "linear-gradient(160deg, #17b877, #0a8a72)",
            flex: "0 0 auto",
          }}
        />

        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
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
              color: "#6b7080",
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
            Running
          </div>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <MetaRow label="Server" value={runtime.remoteUrl} />
          <MetaRow label="Board" value={runtime.boardName || "—"} />
          <MetaRow label="Runtime id" value={runtime.id} />
        </div>

        <div style={{ width: "100%" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--st-mut)",
              marginBottom: 4,
            }}
          >
            Services ({runtime.services.length})
          </div>
          {runtime.services.length === 0 ? (
            <div style={{ fontSize: 12, color: "#9a9fae", padding: "6px 2px" }}>
              No services on this runtime.
            </div>
          ) : (
            runtime.services.map((service) => (
              <ServiceRow key={service.uuid} service={service} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
