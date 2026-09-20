import { useCallback, useEffect, useState } from "react";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import SubServicePipelineUI from "../../ui/SubServicePipelineUI";
import { findServiceUI } from "../UIRegistry";
import { BrowserSubService } from "./BrowserSubService";
import ScopeSlots from "../../ui/ScopeSlots";

function BrowserSubServiceUI(props: ServiceUIProps): JSX.Element {
  // Incremented whenever the inner scope finishes (re)building so that
  // getActualInstance picks up the newly created service instances.
  const [, setScopeVersion] = useState(0);

  const onNotification = useCallback((notification: any) => {
    // `scope` because changing which cells this one holds in re-points the
    // store without rebuilding anything: nothing else would tell the panel
    // reading those cells that it is now reading different ones.
    if (notification?.__innerScopeReady || notification?.scope) {
      setScopeVersion((v) => v + 1);
    }
  }, []);

  const getActualInstance = useCallback(
    (instanceId: string): ServiceInstance | null => {
      const svc = props.service as unknown as BrowserSubService;
      return svc.getInnerInstance?.(instanceId) ?? null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.service],
  );

  return (
    <ServiceUI {...props} onNotification={onNotification}>
      {/* Above the pipeline because it is about the scope rather than about
          any one service in it, and because the pipeline below can be long. */}
      <BrowserScopeSlots service={props.service} />
      <SubServicePipelineUI
        service={props.service}
        findServiceUI={findServiceUI}
        getActualInstance={getActualInstance}
      />
    </ServiceUI>
  );
}

/**
 * What this scope is holding, read straight off the live store.
 *
 * Only the browser runtime can do this: the store is an object in the same
 * process as the panel, so there is nothing to serialise and no round trip.
 * A scope on a REST runtime would have to report its cells in its state first.
 */
function BrowserScopeSlots({ service }: { service: ServiceInstance }) {
  const svc = service as unknown as BrowserSubService;
  const { store, inherited } = svc.slotsInUse?.() ?? {
    store: null,
    inherited: false,
  };

  const [open, setOpen] = useState(false);
  const [cells, setCells] = useState<[string, unknown][]>([]);

  useEffect(() => {
    if (!store) {
      setCells([]);
      return;
    }
    const read = () => {
      setCells((previous) => {
        const next = store.entries();
        // Closed, only the names are on screen, and a cell written on a timer
        // would otherwise re-render this panel every tick for a value nobody
        // is looking at. Same names, same array: React draws nothing.
        return !open && sameNames(previous, next) ? previous : next;
      });
    };
    // Read once on arrival as well as on every write: the cells a scope
    // inherits were very likely written before this panel existed.
    read();
    return store.watch(read);
  }, [store, open]);

  if (svc.state?.mode === "source") {
    return null;
  }

  return (
    <ScopeSlots
      cells={cells}
      slots={svc.state?.scope?.slots ?? "own"}
      inherited={inherited}
      open={open}
      onOpenChange={setOpen}
      onSlotsChange={(next) => service.configure({ scope: { slots: next } })}
      // Straight at the store, because that is where a cell is: a slot is
      // named by the Holds at either end and owned by neither, so there is no
      // service whose configure this could be. The store reports the removal,
      // which is what takes it off the screen here and in any other panel
      // showing these same cells.
      onRemove={(name) => store?.remove(name)}
    />
  );
}

/** Whether two readings of a store hold the same cells, whatever is in them. */
function sameNames(a: [string, unknown][], b: [string, unknown][]): boolean {
  return (
    a.length === b.length && a.every(([name], index) => name === b[index][0])
  );
}

export default BrowserSubServiceUI;
