import { useState } from "react";

import { BindingSite, isServiceBinding } from "./bindings";
import { useFacadeBindings } from "./FacadeBindingsContext";
import { OverlayTabs, ServiceRow, StateRow } from "./panels/BindingRows";

/**
 * The bindings that belong to no widget: what runs when the facade opens
 * (`init`) and what raises a toast (`notices`). Shown under the facade
 * editor's Actions and Updates.
 */

export type FacadeTab = "init" | "notices";

// The facade's own actions — the ones it runs when it opens — and the updates
// it raises as notices: the same words the editor's tree uses for them.
const TAB_TITLES: Record<FacadeTab, string> = {
  init: "Actions",
  notices: "Updates",
};

function toastOf(tone: "info" | "success" | "error"): string {
  return tone === "success" ? "a success toast" : `an ${tone} toast`;
}

/** The facade's own bindings under tabs, in the editor's Actions and Updates. */
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
  const [chosen, setTab] = useState<FacadeTab | null>(null);
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0];

  if (!api) {
    return null;
  }
  const { index } = api;

  const counts: Record<FacadeTab, number> = {
    init: index.init.length,
    notices: index.notices.length,
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
      </div>
    </>
  );
}
