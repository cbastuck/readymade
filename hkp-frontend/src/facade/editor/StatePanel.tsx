import { useMemo } from "react";

import { facadeBindings } from "../bindings";
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
 * The same view as the facade badge's State tab (FacadeStateView); here the
 * widgets are named but not linked, since the editor is not where they are.
 */
export function StatePanel({ facade }: { facade: FacadeDescriptor }) {
  const index = useMemo(() => facadeBindings(facade), [facade]);

  return (
    <div
      aria-label="Facade state"
      role="region"
      style={{
        flexShrink: 0,
        maxHeight: "40%",
        overflowY: "auto",
        borderTop: "1px solid hsl(var(--border))",
        padding: 16,
        fontSize: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "hsl(var(--muted-foreground))",
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 12,
        }}
      >
        state
      </div>

      <FacadeStateView index={index} empty="Nothing in facade state yet." />
    </div>
  );
}
