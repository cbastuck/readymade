import { createContext, useContext } from "react";

import type { SweepState } from "./processingSweep";

/**
 * Where a service frame says whether its service is running, for whatever is
 * drawn in its place.
 *
 * A block use shows a bar instead of its service's frame, which stays mounted
 * but hidden — and only the frame hears when the service runs. It reports that
 * here, so the bar can show it. A frame resets this for what its panel draws,
 * so a service nested inside never reports for the one around it.
 */
export const ServiceProcessingReportContext = createContext<
  ((sweep: SweepState) => void) | null
>(null);

export function useServiceProcessingReport() {
  return useContext(ServiceProcessingReportContext);
}
