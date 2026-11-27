import { ReactNode } from "react";

import { timeOf } from "hkp-frontend/src/ui-components/service/flowRecords";
import { BindingSite, FacadeBindings } from "./bindings";
import { describeValue } from "./describeValue";
import { useFacadeState } from "./FacadeStateContext";
import { SiteLinks, siteLabel } from "./panels/BindingRows";

/**
 * Facade state as something to read: for each key, what it holds now, who
 * writes it and who reads it, and what was last written to it, when and by
 * which widget.
 *
 * Facade state is how one widget reaches another, and it exists only while the
 * facade is on screen, so nothing in the board document shows it. Shown in two
 * places from this one component: the facade badge's State tab, and the facade
 * editor's state panel.
 */

export { describeValue };

/** Every key worth listing: those the facade names, holds, or was written. */
export function stateKeys(
  index: FacadeBindings,
  values: Record<string, unknown>,
  history: Record<string, unknown> = {},
): string[] {
  return [
    ...new Set([
      ...Object.keys(index.state),
      ...Object.keys(values),
      ...Object.keys(history),
    ]),
  ].sort();
}

export function FacadeStateView({
  index,
  onReveal,
  empty,
}: {
  index: FacadeBindings;
  // How a site is brought into view; absent, sites are named but not links.
  onReveal?: (site: BindingSite) => void;
  // What is said while there is nothing to list.
  empty: ReactNode;
}) {
  const { state: values, history = {} } = useFacadeState();
  const keys = stateKeys(index, values, history);

  if (keys.length === 0) {
    return <div className="hkp-binding-empty">{empty}</div>;
  }

  return (
    <ul className="hkp-binding-list hkp-state-list">
      {keys.map((key) => {
        const entry = index.state[key];
        const writes = history[key] ?? [];
        return (
          <li key={key} className="hkp-binding-row" data-state-key={key}>
            <div className="hkp-binding-name hkp-state-key">{key}</div>
            <div className="hkp-binding-value">{describeValue(values[key])}</div>
            {entry?.seeded && (
              <div className="hkp-binding-note">
                Starts with the facade's initial state.
              </div>
            )}
            <SiteLinks
              title="Written by"
              sites={entry?.writers ?? []}
              empty={
                entry?.seeded
                  ? "No widget writes it."
                  : "Nothing in the facade writes it."
              }
              onReveal={onReveal}
            />
            <SiteLinks
              title="Read by"
              sites={entry?.readers ?? []}
              empty="Nothing reads it."
              onReveal={onReveal}
            />
            {writes.length > 0 && (
              <details className="hkp-binding-history">
                <summary>Recent writes · {writes.length}</summary>
                <ol>
                  {writes.map((write, i) => (
                    <li key={`${write.at}-${i}`}>
                      <span className="hkp-binding-history-time">
                        {timeOf(write.at)}
                      </span>{" "}
                      <span className="hkp-binding-value">
                        {describeValue(write.value)}
                      </span>{" "}
                      <span className="hkp-binding-history-meta">
                        by{" "}
                        {write.writer?.kind === "init"
                          ? "the facade on open"
                          : write.writer
                            ? siteLabel(write.writer)
                            : "the facade"}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
