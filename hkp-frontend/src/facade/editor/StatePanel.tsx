import { useMemo } from "react";

import { BindingSite, facadeBindings } from "../bindings";
import { FacadeStateView } from "../FacadeStateView";
import { FacadeDescriptor } from "../types";

/**
 * What the facade's state holds right now, who writes and reads each key, and
 * what was last written to it.
 *
 * Facade state is how one widget reaches another — a selection published under
 * a key, read elsewhere as { "$state": "<key>" } — and it exists only while the
 * facade is on screen, so nothing in the board document shows it. Read here
 * from the same store the widgets write to, it follows them as they are used.
 * A key whose value was given up stays listed, as not set.
 *
 * The same view as the facade badge's State tab (FacadeStateView). The index
 * is built from the facade being edited, so it follows the draft.
 */
export function StatePanel({
  facade,
  onRevealSite,
  height,
}: {
  facade: FacadeDescriptor;
  // As dragged in the editor; unset, it takes what it needs up to a share.
  height?: number | null;
  // How a writer or reader is shown — in the editor, by selecting it.
  onRevealSite?: (site: BindingSite) => void;
}) {
  const index = useMemo(() => facadeBindings(facade), [facade]);

  return (
    <div
      aria-label="Facade state"
      role="region"
      className="hkp-editor-state"
      style={
        height != null ? { height, maxHeight: "none" } : undefined
      }
    >
      <div className="hkp-editor-section-title">State</div>
      <div className="hkp-editor-card">
        <FacadeStateView
          index={index}
          onReveal={onRevealSite}
          empty="Nothing in facade state yet."
        />
      </div>
    </div>
  );
}
