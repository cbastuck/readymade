import { useCallback, useRef } from "react";
import { ServiceInstance } from "../types";
import { useBoardContext } from "../BoardContext";

/**
 * The service, as handed to a person's controls: its `configure` also reports
 * that the board was changed.
 *
 * Reported here, at the controls, rather than inside the runtime, because a
 * runtime cannot tell who is calling. A Configurator driving a service from
 * its pipeline, a board being restored and a person turning a knob all arrive
 * as the same `configure` there; only the first is not an edit to the board.
 *
 * A Proxy rather than a copy so that everything else is still the service
 * itself — its methods, its live state, and what its notifications are filed
 * under.
 */
export function withEditReporting(
  service: ServiceInstance,
  onEdit: () => void,
): ServiceInstance {
  const configure = (config: any) => {
    const result = service.configure(config);
    void Promise.resolve(result).finally(onEdit);
    return result;
  };
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (prop === "configure") {
        return configure;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Maps a service to the one its panel is given (see `withEditReporting`).
 *
 * The same service always maps to the same object: panels key their effects on
 * the service they are handed, and a new identity on every render would set
 * each of them up again.
 */
export function useEditReportingService(): (
  service: ServiceInstance,
) => ServiceInstance {
  const boardContext = useBoardContext();
  const markRef = useRef(boardContext?.markBoardChanged);
  markRef.current = boardContext?.markBoardChanged;
  const reporting = useRef(new WeakMap<object, ServiceInstance>());

  return useCallback((service: ServiceInstance) => {
    if (!service || typeof service.configure !== "function") {
      return service;
    }
    let wrapped = reporting.current.get(service);
    if (!wrapped) {
      wrapped = withEditReporting(service, () => markRef.current?.());
      reporting.current.set(service, wrapped);
    }
    return wrapped;
  }, []);
}
