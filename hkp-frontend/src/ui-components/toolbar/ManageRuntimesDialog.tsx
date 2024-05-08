import { Dialog, DialogContent } from "@/ui-components/primitives/dialog";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";

import { RuntimeClass } from "@/types";

import NewRuntimePanel from "./NewRuntimePanel";
import ExistingRuntimesPanel from "./ExistingRuntimesPanel";
import { Button } from "@/ui-components/primitives/button";
import { useState } from "react";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  isOpen: boolean;
  onRemoveRuntime: (rt: RuntimeClass) => void;
  onAddAvailableRuntime: (desc: RuntimeClass) => void;
  onClose: () => void;
};

export default ({
  isOpen,
  remoteRuntimes,
  onRemoveRuntime,
  onAddAvailableRuntime,
  onClose,
}: Props) => {
  const [showNewRuntimePanel, setShowNewRuntimePanel] = useState(false);
  const onAddRuntime = (rt: RuntimeClass) => {
    onAddAvailableRuntime(rt);
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
  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[525px] h-[80%] flex flex-col">
        <h2>Manage runtimes</h2>
        <ExistingRuntimesPanel
          remoteRuntimes={remoteRuntimes}
          onRemoveRuntime={onRemoveRuntime}
        />

        <Popover open={showNewRuntimePanel}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              onClick={() => setShowNewRuntimePanel(true)}
            >
              Add Remote Runtime
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <NewRuntimePanel onAddRuntime={onAddRuntime} />
          </PopoverContent>
        </Popover>
      </DialogContent>
    </Dialog>
  );
};
