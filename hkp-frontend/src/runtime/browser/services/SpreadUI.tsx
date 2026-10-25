import { useState } from "react";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function SpreadUI(props: ServiceUIProps) {
  const { service } = props;
  const [itemsFrom, setItemsFrom] = useState("");
  const [lastTotal, setLastTotal] = useState<number | undefined>(undefined);

  const read = (state: any) => {
    if (typeof state?.itemsFrom === "string") {
      setItemsFrom(state.itemsFrom);
    }
    if (typeof state?.lastTotal === "number") {
      setLastTotal(state.lastTotal);
    }
  };

  return (
    <ServiceUI {...props} onInit={read} onNotification={read}>
      <div className="flex flex-col" style={{ minWidth: 220 }}>
        {/* Empty means the input itself; a path reaches into a result that
            says more than the list. */}
        <InputField
          label="Items from"
          value={itemsFrom}
          onChange={(value) => service.configure({ itemsFrom: value })}
        />
        <div className="hkp-svc-field-label" style={{ fontSize: 12, marginTop: 6 }}>
          {lastTotal === undefined
            ? "Nothing spread yet"
            : `Last sent on ${lastTotal} item${lastTotal === 1 ? "" : "s"}`}
        </div>
      </div>
    </ServiceUI>
  );
}
