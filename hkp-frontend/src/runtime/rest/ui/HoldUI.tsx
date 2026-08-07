import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

export default function HoldUI(props: ServiceUIProps) {
  const [property, setProperty] = useState<string>("");
  const [held, setHeld] = useState<unknown>(null);
  const [readCount, setReadCount] = useState<number>(0);
  const [writeCount, setWriteCount] = useState<number>(0);

  // Null is the empty value, not a held one.
  const hasHeld = held !== null;

  const onUpdate = useCallback((state: any) => {
    if (state.property !== undefined) {
      setProperty(state.property);
    }
    if (state.held !== undefined) {
      setHeld(state.held);
    }
    if (state.readCount !== undefined) {
      setReadCount(state.readCount);
    }
    if (state.writeCount !== undefined) {
      setWriteCount(state.writeCount);
    }
  }, []);

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 280 }}>
        <InputField
          label="Property"
          value={property}
          onChange={(value) => {
            setProperty(value);
            props.service.configure({ property: value });
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          An input carrying this property replaces what is held. Every call
          emits the held value under the same name, and stops while nothing is
          held.
        </div>

        <div className="flex items-center justify-between">
          {/* Which side has been calling — a producer that has stopped writing
              shows up here as reads without writes. */}
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            reads: {readCount} · writes: {writeCount}
          </span>
          <Button
            className="hkp-svc-btn"
            disabled={!hasHeld}
            onClick={() => props.service.configure({ action: "clear" })}
          >
            Clear
          </Button>
        </div>

        <div className="border border-gray-300 p-2">
          <h3 className="tracking-[6px]">Held</h3>
          <pre
            style={{
              fontSize: 12,
              margin: 0,
              maxHeight: 160,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {hasHeld ? JSON.stringify(held, null, 2) : "nothing held yet"}
          </pre>
        </div>
      </div>
    </RuntimeRestServiceUI>
  );
}
