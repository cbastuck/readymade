import { useState } from "react";
import { Link2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { BindingSite, isServiceBinding } from "./bindings";
import { useFacadeBindings } from "./FacadeBindingsContext";
import { useFacadeState } from "./FacadeStateContext";
import {
  OverlayTabs,
  ServiceRow,
  SiteLinks,
  StateRow,
} from "./panels/BindingRows";

/**
 * The facade's own badge: the bindings that belong to no widget.
 *
 * What runs when the facade opens (`init`), what raises a toast (`notices`),
 * and the facade state through which one widget reaches another — each key's
 * value now, who writes it and who reads it. Drawn on the divider between the
 * facade and the board, which is only there while both are on screen, which is
 * the one view where a binding has somewhere to point.
 */

type Tab = "init" | "notices" | "state";

const TAB_TITLES: Record<Tab, string> = {
  init: "Runs on open",
  notices: "Notices from",
  state: "State",
};

/** A value as the State tab shows it: short, and saying when there is none. */
export function describeValue(value: unknown): string {
  if (value === undefined) {
    return "not set";
  }
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > 160 ? `${text.slice(0, 159)}…` : text;
}

function toastOf(tone: "info" | "success" | "error"): string {
  return tone === "success" ? "a success toast" : `an ${tone} toast`;
}

export function FacadeBindingsBadge() {
  const api = useFacadeBindings();
  const { state: values } = useFacadeState();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("state");

  if (!api) {
    return null;
  }
  const { index } = api;
  // Every key the facade mentions, and any it holds that nothing mentions —
  // written by a widget whose key is made up as it runs.
  const keys = [
    ...new Set([...Object.keys(index.state), ...Object.keys(values)]),
  ].sort();

  const counts: Record<Tab, number> = {
    init: index.init.length,
    notices: index.notices.length,
    state: keys.length,
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      api.refreshLocations();
    }
    setOpen(next);
  };
  const reveal = (site: BindingSite) => {
    setOpen(false);
    api.revealWidget(site);
  };
  const done = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hkp-facade-binding-badge"
          aria-label="What the facade runs, raises and keeps"
          title="What the facade runs on open, the notices it raises and its state"
          // The divider under it is dragged; the badge is pressed.
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Link2 size={11} />
          Facade
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="hkp-binding-overlay"
        align="end"
        style={{ width: "min(400px, 92vw)", padding: 0 }}
      >
        <OverlayTabs
          tabs={(["init", "notices", "state"] as const).map((id) => ({
            id,
            title: TAB_TITLES[id],
            count: counts[id],
          }))}
          active={tab}
          onSelect={setTab}
        />
        <ul
          className="hkp-binding-list"
          role="tabpanel"
          aria-label={TAB_TITLES[tab]}
        >
          {tab === "init" &&
            (index.init.length === 0 ? (
              <li className="hkp-binding-empty">Nothing runs when it opens.</li>
            ) : (
              index.init.flatMap(({ site, bindings }) =>
                bindings.map((binding, i) =>
                  isServiceBinding(binding) ? (
                    <ServiceRow
                      key={`${site.kind}-${"index" in site ? site.index : 0}-${i}`}
                      binding={binding}
                      location={api.locate(binding.service)}
                      onDone={done}
                    />
                  ) : (
                    <StateRow
                      key={`${"index" in site ? site.index : 0}-${i}`}
                      binding={binding}
                      own={site}
                      onReveal={reveal}
                    />
                  ),
                ),
              )
            ))}

          {tab === "notices" &&
            (index.notices.length === 0 ? (
              <li className="hkp-binding-empty">It raises no notices.</li>
            ) : (
              index.notices.flatMap(({ bindings, tone, message }, n) =>
                bindings.filter(isServiceBinding).map((binding, i) => (
                  <ServiceRow
                    key={`${n}-${i}`}
                    binding={binding}
                    location={api.locate(binding.service)}
                    note={
                      message
                        ? `Raises ${toastOf(tone)}: “${message}”`
                        : `Raises ${toastOf(tone)} saying the value`
                    }
                    onDone={done}
                  />
                )),
              )
            ))}

          {tab === "state" &&
            (keys.length === 0 ? (
              <li className="hkp-binding-empty">The facade keeps no state.</li>
            ) : (
              keys.map((key) => {
                const entry = index.state[key];
                return (
                  <li key={key} className="hkp-binding-row">
                    <div className="hkp-binding-name">“{key}”</div>
                    <div className="hkp-binding-value">
                      {describeValue(values[key])}
                    </div>
                    {entry?.seeded && (
                      <div className="hkp-binding-note">
                        Starts with the facade's initial state.
                      </div>
                    )}
                    <SiteLinks
                      title="Written by"
                      sites={entry?.writers ?? []}
                      empty={
                        entry?.seeded ? "No widget writes it." : "Nothing in the facade writes it."
                      }
                      onReveal={reveal}
                    />
                    <SiteLinks
                      title="Read by"
                      sites={entry?.readers ?? []}
                      empty="Nothing reads it."
                      onReveal={reveal}
                    />
                  </li>
                );
              })
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
