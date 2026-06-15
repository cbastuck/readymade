import { createContext, useContext } from "react";

/**
 * True when the surrounding tree is the touch-first mobile host (the mobile
 * playground / cloud board), as opposed to the desktop playground.
 *
 * Mobile vs desktop is normally decided at the route boundary, where each
 * mounts a separate component tree. This context exposes that fact *inside*
 * the tree so shared components — rendered by both hosts — can adapt their
 * presentation without resorting to device sniffing (`pointer: coarse`), which
 * would misfire on touch laptops or a desktop app on a touchscreen.
 *
 * Current consumers:
 * - `SubServicePipelineUI` omits its desktop drag-and-drop editor so the mobile
 *   host can provide its own breadcrumb drill-down instead.
 */
export const MobileHostContext = createContext(false);

export function useIsMobileHost(): boolean {
  return useContext(MobileHostContext);
}
