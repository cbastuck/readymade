import { useCallback, useState } from "react";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import BrowserSubServiceUI from "./BrowserSubServiceUI";

/**
 * The Iterator panel: what it iterates over, above the scope it runs per item.
 */
export default function IteratorUI(props: ServiceUIProps) {
  const { service } = props;
  const [itemsFrom, setItemsFrom] = useState("");
  const [limit, setLimit] = useState(0);
  const [last, setLast] = useState<{ items: number; failed: number } | null>(
    null,
  );

  const onState = useCallback((state: any) => {
    if (typeof state?.itemsFrom === "string") {
      setItemsFrom(state.itemsFrom);
    }
    if (typeof state?.limit === "number") {
      setLimit(state.limit);
    }
    // Only once something has run: a board saved before then says 0 for both,
    // which is not the same as having iterated over nothing.
    if (typeof state?.items === "number") {
      setLast({ items: state.items, failed: state.failed ?? 0 });
    }
  }, []);

  return (
    <BrowserSubServiceUI {...props} onState={onState}>
      <div className="flex flex-col pb-2" style={{ minWidth: 220 }}>
        {/* Empty means the input itself; a path reaches into a result that
            says more than the list. */}
        <InputField
          label="Items from"
          value={itemsFrom}
          onChange={(value) => service.configure({ itemsFrom: value })}
        />
        <InputField
          label="Limit"
          value={limit > 0 ? String(limit) : ""}
          onChange={(value) => {
            const parsed = Number.parseInt(value, 10);
            service.configure({ limit: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
          }}
        />
        <div className="hkp-svc-field-label" style={{ fontSize: 12, marginTop: 6 }}>
          {last === null
            ? "Nothing iterated yet"
            : `Last ran ${last.items} item${last.items === 1 ? "" : "s"}${
                last.failed > 0 ? `, ${last.failed} failed` : ""
              }`}
        </div>
      </div>
    </BrowserSubServiceUI>
  );
}
