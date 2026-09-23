import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";
import ScopeOutput from "../../ui/ScopeOutput";
import ScopeSlots from "../../ui/ScopeSlots";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";

/**
 * A scope on a REST runtime.
 *
 * The same panel the browser runtime's scope has, for the same reason Hold's
 * is shared: a scope is one thing whichever runtime is running it, and what
 * there is to say about it — where its answer goes, where its cells are, what
 * its pipeline holds — does not change with the distance to it. Without this
 * the generic editor drew the two declarations as whatever their spelling in
 * the board happened to be: `stopPropagation` as a switch reading true/false,
 * and `scope.slots` as a text field to type "inherit" into.
 *
 * The one difference is the cells themselves. The browser panel reads them off
 * the live store, which is an object in the same process; here the store is on
 * the far end and nothing carries it, so the section reports the origin and
 * says nothing about what is held (`cells={null}`) rather than reporting an
 * empty scope.
 *
 * An edit is a request, so what is on screen is shown at once and then
 * replaced by what the far end reports, the same way Tracks does it.
 */
export default function SubServiceUI(props: ServiceUIProps) {
  const { service } = props;
  const [stops, setStops] = useState(false);
  const [slots, setSlots] = useState<"own" | "inherit">("own");

  const read = useCallback((state: any) => {
    if (typeof state?.stopPropagation === "boolean") {
      setStops(state.stopPropagation);
    }
    const origin = state?.scope?.slots;
    if (origin === "own" || origin === "inherit") {
      setSlots(origin);
    }
  }, []);

  const edit = useCallback(
    async (payload: object) => {
      await service.configure(payload);
      read(await service.getConfiguration?.());
    },
    [service, read],
  );

  return (
    <RuntimeRestServiceUI
      {...props}
      onInit={read}
      onNotification={read}
      genericUI={false}
      initialSize={{ width: 320, height: undefined }}
    >
      {/* Above the pipeline for the reason they are above it in the browser
          panel: they are about the scope rather than about any one service in
          it, and the pipeline below can be long. */}
      <ScopeOutput
        stops={stops}
        onChange={(next) => {
          setStops(next);
          void edit({ stopPropagation: next });
        }}
      />
      <ScopeSlots
        cells={null}
        slots={slots}
        inherited={slots === "inherit"}
        open={false}
        onOpenChange={() => {}}
        onSlotsChange={(next) => {
          setSlots(next);
          void edit({ scope: { slots: next } });
        }}
      />
      <div className="pb-2">
        <SubServicePipelineUI service={service} findServiceUI={findServiceUI} />
      </div>
    </RuntimeRestServiceUI>
  );
}
