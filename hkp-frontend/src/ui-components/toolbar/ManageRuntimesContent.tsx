import { useState } from "react";
import { Plus } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { RuntimeClass } from "hkp-frontend/src/types";

import NewRuntimePanel from "./NewRuntimePanel";
import ExistingRuntimesPanel from "./ExistingRuntimesPanel";
import DiscoverRuntimesPanel from "./DiscoverRuntimesPanel";

export type ManageRuntimesContentProps = {
  remoteRuntimes: Array<RuntimeClass>;
  onRemoveRuntimeEngine: (rt: RuntimeClass) => void;
  onAddRuntimeEngine: (desc: RuntimeClass) => void;
  onUpdateRuntimeEngine: (updated: RuntimeClass) => void;
  /** Render the add-runtime form inline below the button instead of in a
   *  popover. Hosts above the popover's z-layer (the mobile bottom sheet,
   *  where the body-portaled popover would end up behind the sheet) use
   *  this; it also reads better on small screens. */
  inlineNewRuntimePanel?: boolean;
};

// The single source for remote-runtime management: the list of registered
// remotes, LAN discovery, and manual registration. Hosts wrap it in whatever
// surface fits — a Dialog on desktop/web (ManageRuntimesDialog), a BottomSheet
// on mobile (ManageRemotesSheet).
export default function ManageRuntimesContent({
  remoteRuntimes,
  onRemoveRuntimeEngine,
  onAddRuntimeEngine,
  onUpdateRuntimeEngine,
  inlineNewRuntimePanel = false,
}: ManageRuntimesContentProps) {
  const [showNewRuntimePanel, setShowNewRuntimePanel] = useState(false);

  const onAddRuntime = (rt: RuntimeClass) => {
    onAddRuntimeEngine(rt);
    setShowNewRuntimePanel(false);
  };

  const onChangeRuntimeColor = (rt: RuntimeClass, color: string) => {
    onUpdateRuntimeEngine({ ...rt, color });
  };

  return (
    <div className="flex flex-col gap-4">
      <ExistingRuntimesPanel
        remoteRuntimes={remoteRuntimes}
        onRemoveRuntime={onRemoveRuntimeEngine}
        onChangeRuntimeColor={onChangeRuntimeColor}
      />

      <DiscoverRuntimesPanel
        existing={remoteRuntimes}
        onAdd={onAddRuntimeEngine}
      />

      {inlineNewRuntimePanel ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setShowNewRuntimePanel(!showNewRuntimePanel)}
            className="gap-2"
          >
            <Plus size={14} />
            Add an external runtime
          </Button>
          {showNewRuntimePanel && (
            <div className="rounded-lg border border-slate-200 p-3">
              <NewRuntimePanel onAddRuntime={onAddRuntime} />
            </div>
          )}
        </div>
      ) : (
        <Popover
          open={showNewRuntimePanel}
          onOpenChange={setShowNewRuntimePanel}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setShowNewRuntimePanel(true)}
              className="gap-2"
            >
              <Plus size={14} />
              Add an external runtime
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <NewRuntimePanel onAddRuntime={onAddRuntime} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
