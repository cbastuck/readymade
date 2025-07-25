import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";

import { RuntimeClass } from "hkp-frontend/src/types";

import NewRuntimePanel from "./NewRuntimePanel";
import ExistingRuntimesPanel from "./ExistingRuntimesPanel";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { useState } from "react";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  isOpen: boolean;
  onRemoveRuntimeEngine: (rt: RuntimeClass) => void;
  onAddRuntimeEngine: (desc: RuntimeClass) => void;
  onUpdateRuntimeEngine: (updated: RuntimeClass) => void;
  onClose: () => void;
};

export default function ManageRuntimesDialog({
  isOpen,
  remoteRuntimes,
  onRemoveRuntimeEngine,
  onAddRuntimeEngine,
  onUpdateRuntimeEngine,
  onClose,
}: Props) {
  const [showNewRuntimePanel, setShowNewRuntimePanel] = useState(false);
  const onAddRuntime = (rt: RuntimeClass) => {
    onAddRuntimeEngine(rt);
    setShowNewRuntimePanel(false);
  };

  const onChangeDialogOpen = (newOpen: boolean) => {
    if (!newOpen) {
      if (showNewRuntimePanel) {
        setShowNewRuntimePanel(false);
      } else {
        onClose();
      }
    }
  };

  const onChangeRuntimeColor = (rt: RuntimeClass, color: string) => {
    onUpdateRuntimeEngine({ ...rt, color });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[825px] h-[80vh] flex flex-col overflow-y-scroll">
        <h2>Manage runtimes</h2>
        <ExistingRuntimesPanel
          remoteRuntimes={remoteRuntimes}
          onRemoveRuntime={onRemoveRuntimeEngine}
          onChangeRuntimeColor={onChangeRuntimeColor}
        />

        <Popover open={showNewRuntimePanel}>
          <PopoverTrigger asChild>
            <Button
              className="text-md tracking-widest"
              variant="outline"
              onClick={() => setShowNewRuntimePanel(true)}
            >
              Add an external Runtime
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <NewRuntimePanel onAddRuntime={onAddRuntime} />
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  );
}
