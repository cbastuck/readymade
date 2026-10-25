import { useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import BrowserSubServiceUI from "./BrowserSubServiceUI";

const MIB = 1024 * 1024;

/**
 * The Gather panel: how much it will hold and for how long, what it is waiting
 * on, and the scope that makes one value of a complete group.
 */
export default function GatherUI(props: ServiceUIProps) {
  const { service } = props;
  const [maxBytes, setMaxBytes] = useState(64 * MIB);
  const [maxGroups, setMaxGroups] = useState(16);
  const [timeoutMs, setTimeoutMs] = useState(60_000);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");

  const onState = useCallback((state: any) => {
    if (typeof state?.maxBytes === "number") {
      setMaxBytes(state.maxBytes);
    }
    if (typeof state?.maxGroups === "number") {
      setMaxGroups(state.maxGroups);
    }
    if (typeof state?.timeoutMs === "number") {
      setTimeoutMs(state.timeoutMs);
    }
    if (typeof state?.pending === "number") {
      setPending(state.pending);
    }
    if (typeof state?.error === "string") {
      setError(state.error);
    }
  }, []);

  return (
    <BrowserSubServiceUI {...props} onState={onState}>
      <div className="flex flex-col pb-2" style={{ minWidth: 220 }}>
        <InputField
          label="Max size"
          unit="MiB"
          value={String(Math.round((maxBytes / MIB) * 100) / 100)}
          onChange={(value) => {
            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              service.configure({ maxBytes: Math.floor(parsed * MIB) });
            }
          }}
        />
        <InputField
          label="Max groups"
          value={String(maxGroups)}
          onChange={(value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 1) {
              service.configure({ maxGroups: parsed });
            }
          }}
        />
        <InputField
          label="Timeout"
          unit="s"
          value={String(timeoutMs / 1000)}
          onChange={(value) => {
            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              service.configure({ timeoutMs: Math.floor(parsed * 1000) });
            }
          }}
        />
        <div className="hkp-svc-field-label" style={{ fontSize: 12, marginTop: 6 }}>
          {pending === 0
            ? "Nothing incomplete"
            : `Waiting on ${pending} group${pending === 1 ? "" : "s"}`}
        </div>
        {error && (
          <div className="text-xs text-red-600 break-words mt-1">{error}</div>
        )}
      </div>
    </BrowserSubServiceUI>
  );
}
