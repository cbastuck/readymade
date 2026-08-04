import { useState } from "react";
import { Plus } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { CoordinatorDescriptor } from "../../common";
import ExistingCoordinatorsPanel from "./ExistingCoordinatorsPanel";
import NewCoordinatorPanel from "./NewCoordinatorPanel";

export type ManageCoordinatorsContentProps = {
  coordinators: CoordinatorDescriptor[];
  onAdd: (coordinator: CoordinatorDescriptor) => void;
  onRemove: (coordinator: CoordinatorDescriptor) => void;
  /** Render the add form inline below the button instead of in a popover.
   *  Hosts above the popover's z-layer use this; it also reads better in a
   *  narrow surface such as a settings tab. */
  inlineNewCoordinatorPanel?: boolean;
};

// The single source for coordinator management: the registered coordinators
// and the form to add one. Hosts wrap it in whatever surface fits — a Dialog
// from the Cloud Boards view, a settings tab on the start page.
export default function ManageCoordinatorsContent({
  coordinators,
  onAdd,
  onRemove,
  inlineNewCoordinatorPanel = false,
}: ManageCoordinatorsContentProps) {
  const [showNewPanel, setShowNewPanel] = useState(false);

  const handleAdd = (coordinator: CoordinatorDescriptor) => {
    onAdd(coordinator);
    setShowNewPanel(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <ExistingCoordinatorsPanel
        coordinators={coordinators}
        onRemove={onRemove}
      />

      {inlineNewCoordinatorPanel ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setShowNewPanel(!showNewPanel)}
            className="gap-2"
          >
            <Plus size={14} />
            Add a coordinator
          </Button>
          {showNewPanel && (
            <div className="rounded-lg border border-slate-200 p-3">
              <NewCoordinatorPanel onAdd={handleAdd} />
            </div>
          )}
        </div>
      ) : (
        <Popover open={showNewPanel} onOpenChange={setShowNewPanel}>
          <PopoverTrigger asChild>
            <Button
              className="text-md tracking-widest self-start"
              variant="outline"
              onClick={() => setShowNewPanel(true)}
            >
              Add Coordinator
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <NewCoordinatorPanel onAdd={handleAdd} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
