import { useCallback, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubServicePipelineUI from "hkp-frontend/src/runtime/ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";
import { HttpRelayClient } from "./HttpRelayClient";
import { toVault } from "./base/eval";

const STATUS_COLOR: Record<string, string> = {
  idle: "hsl(var(--muted-foreground))",
  online: "#22c55e",
  serving: "#3b82f6",
  offline: "#ef4444",
};

const inputStyle: React.CSSProperties = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 4,
  padding: "4px 6px",
  color: "hsl(var(--foreground))",
  fontFamily: "monospace",
  fontSize: 11,
  width: "100%",
};

export default function HttpRelayClientUI(props: ServiceUIProps) {
  const { service } = props;
  const [pollUrl, setPollUrl] = useState("");
  const [respondUrl, setRespondUrl] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const [pollCount, setPollCount] = useState(0);
  const [bypassAfter, setBypassAfter] = useState<string>("");
  const [authVaultKey, setAuthVaultKey] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [, setScopeVersion] = useState(0);

  const onNotification = useCallback((n: any) => {
    if (n.pollUrl !== undefined) setPollUrl(n.pollUrl);
    if (n.respondUrl !== undefined) setRespondUrl(n.respondUrl);
    if (n.status !== undefined) setStatus(n.status);
    if (n.pollCount !== undefined) setPollCount(n.pollCount);
    if (n.bypassAfterNumberOfPolls !== undefined) {
      setBypassAfter(
        n.bypassAfterNumberOfPolls != null
          ? String(n.bypassAfterNumberOfPolls)
          : "",
      );
    }
    if (n.authVaultKey !== undefined) setAuthVaultKey(n.authVaultKey);
    if (n.__innerScopeReady) setScopeVersion((v) => v + 1);
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = service as unknown as HttpRelayClient;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    [service],
  );

  return (
    <ServiceUI
      {...props}
      onInit={(s: any) => {
        if (s.pollUrl !== undefined) setPollUrl(s.pollUrl);
        if (s.respondUrl !== undefined) setRespondUrl(s.respondUrl);
        if (s.status !== undefined) setStatus(s.status);
        if (s.bypassAfterNumberOfPolls != null) {
          setBypassAfter(String(s.bypassAfterNumberOfPolls));
        }
        if (s.authVaultKey !== undefined) setAuthVaultKey(s.authVaultKey);
      }}
      onNotification={onNotification}
    >
      <div
        style={{
          padding: "10px",
          fontFamily: "monospace",
          fontSize: "12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Status + poll counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              color: STATUS_COLOR[status] ?? STATUS_COLOR.idle,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ●
          </span>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            {status}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {pollCount > 0 && <span>{pollCount}</span>}
            <span>/</span>
            <input
              type="number"
              min={1}
              placeholder="∞"
              value={bypassAfter}
              onChange={(e) => setBypassAfter(e.target.value)}
              onBlur={() => {
                const n = bypassAfter === "" ? null : parseInt(bypassAfter, 10);
                service.configure({
                  bypassAfterNumberOfPolls: isNaN(n as number) ? null : n,
                });
              }}
              style={{ ...inputStyle, width: 52, textAlign: "right" }}
            />
            <span>polls</span>
          </span>
        </div>

        {/* Poll URL */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            Poll URL
          </span>
          <input
            value={pollUrl}
            onChange={(e) => setPollUrl(e.target.value)}
            onBlur={() => service.configure({ pollUrl })}
            placeholder="https://example.com/poll-abc123.php"
            style={inputStyle}
          />
        </label>

        {/* Respond URL */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            Respond URL
          </span>
          <input
            value={respondUrl}
            onChange={(e) => setRespondUrl(e.target.value)}
            onBlur={() => service.configure({ respondUrl })}
            placeholder="https://example.com/respond-abc123.php"
            style={inputStyle}
          />
        </label>

        {/* Auth */}
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            Auth vault key
          </span>
          <input
            value={authVaultKey}
            onChange={(e) => setAuthVaultKey(e.target.value)}
            onBlur={() => service.configure({ authVaultKey })}
            placeholder="e.g. relay-auth"
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            Auth token (stored in vault)
          </span>
          <input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            onBlur={() => {
              if (authVaultKey && authToken) {
                toVault(authVaultKey, authToken);
              }
            }}
            placeholder="secret token"
            style={inputStyle}
          />
        </label>

        {/* Inner pipeline */}
        <div style={{ marginTop: 4 }}>
          <SubServicePipelineUI
            service={service}
            findServiceUI={findServiceUI}
            getActualInstance={getActualInstance}
          />
        </div>
      </div>
    </ServiceUI>
  );
}
