import { createContext, useContext } from "react";

/**
 * How a `show-panel` action reaches the host showing the facade.
 *
 * Which panels are on screen is the host's to decide — the desktop renderer
 * puts them side by side, the mobile view opens a detail over its master — so
 * the action only names the panel and each host brings it into view its own
 * way. A host that mounts no provider has nothing to switch between, and the
 * action does nothing.
 */
export type FacadePanelNavigation = {
  showPanel: (id: string) => void;
};

export const FacadePanelNavigationContext =
  createContext<FacadePanelNavigation>({
    showPanel: () => {},
  });

export const useFacadePanelNavigation = () =>
  useContext(FacadePanelNavigationContext);
