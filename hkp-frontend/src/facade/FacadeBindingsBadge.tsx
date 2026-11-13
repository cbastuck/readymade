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
import { OverlayTabs, ServiceRow, StateRow } from "./panels/BindingRows";
import { FacadeStateView, stateKeys } from "./FacadeStateView";

/**
 * The facade's own badge: the bindings that belong to no widget.
 *
 * What runs when the facade opens (`init`), what raises a toast (`notices`),
 * and the facade state through which one widget reaches another — each key's
 * value now, who writes it and who reads it. Drawn on the divider between the
 * facade and the board, which is only there while both are on screen, which is
 * the one view where a binding has somewhere to point.
 */

export type FacadeTab = "init" | "notices" | "state";

// The facade's own actions — the ones it runs when it opens — and the updates
// it raises as notices: the same words the editor's tree uses for them.
const TAB_TITLES: Record<FacadeTab, string> = {
  init: "Actions",
  notices: "Updates",
  state: "State",
};

function toastOf(tone: "info" | "success" | "error"): string {
  return tone === "success" ? "a success toast" : `an ${tone} toast`;
}

/**
 * The facade's own bindings under tabs — the divider badge's overlay, and the
 * facade editor's view of the facade as a whole, which leaves the State tab to
 * the editor's state panel.
 */
export function FacadeBindings({
  tabs,
  onDone,
  onRevealSite,
}: {
  tabs: FacadeTab[];
  // Called once a row has taken the person somewhere else.
  onDone: () => void;
  // How a widget is brought into view, from a state key's links.
  onRevealSite: (site: BindingSite) => void;
}) {
  const api = useFacadeBindings();
  const { state: values, history } = useFacadeState();
  const [chosen, setTab] = useState<FacadeTab | null>(null);
  // State where it is offered — the badge's most looked-at tab — and
  // otherwise the first.
  const tab =
    chosen && tabs.includes(chosen)
      ? chosen
      : tabs.includes("state")
        ? "state"
        : tabs[0];

  if (!api) {
    return null;
  }
  const { index } = api;
  // Every key the facade mentions, and any it holds that nothing mentions —
  // written by a widget whose key is made up as it runs.
  const keys = stateKeys(index, values, history);

  const counts: Record<FacadeTab, number> = {
    init: index.init.length,
    notices: index.notices.length,
    state: keys.length,
  };

  return (
    <>
      <OverlayTabs
        tabs={tabs.map((id) => ({
          id,
          title: TAB_TITLES[id],
          count: counts[id],
        }))}
        active={tab}
        onSelect={setTab}
      />
      <div role="tabpanel" aria-label={TAB_TITLES[tab]}>
        {tab === "init" && (
          <ul className="hkp-binding-list">
            {index.init.length === 0 ? (
              <li className="hkp-binding-empty">Nothing runs when it opens.</li>
            ) : (
              index.init.flatMap(({ site, bindings }) =>
                bindings.map((binding, i) => {
                  const key = `${"index" in site ? site.index : 0}-${i}`;
                  return isServiceBinding(binding) ? (
                    <ServiceRow
                      key={key}
                      binding={binding}
                      location={api.locate(binding.service)}
                      sender={site}
                      onDone={onDone}
                    />
                  ) : (
                    <StateRow
                      key={key}
                      binding={binding}
                      own={site}
                      onReveal={onRevealSite}
                    />
                  );
                }),
              )
            )}
          </ul>
        )}
        {tab === "notices" && (
          <ul className="hkp-binding-list">
            {index.notices.length === 0 ? (
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
                    onDone={onDone}
                  />
                )),
              )
            )}
          </ul>
        )}
        {tab === "state" && (
          <FacadeStateView
            index={index}
            onReveal={onRevealSite}
            empty="The facade keeps no state."
          />
        )}
      </div>
    </>
  );
}

export function FacadeBindingsBadge() {
  const api = useFacadeBindings();
  const [open, setOpen] = useState(false);

  if (!api?.badges) {
    return null;
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      api.refreshLocations();
    }
    setOpen(next);
  };

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
        <FacadeBindings
          tabs={["init", "notices", "state"]}
          onDone={() => setOpen(false)}
          onRevealSite={(site) => {
            setOpen(false);
            api.revealWidget(site);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
