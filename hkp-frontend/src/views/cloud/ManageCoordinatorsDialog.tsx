import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import { CoordinatorDescriptor } from "../../common";
import ExistingCoordinatorsPanel from "./ExistingCoordinatorsPanel";
import NewCoordinatorPanel from "./NewCoordinatorPanel";

type Props = {
  isOpen: boolean;
  coordinators: CoordinatorDescriptor[];
  onAdd: (coordinator: CoordinatorDescriptor) => void;
  onRemove: (coordinator: CoordinatorDescriptor) => void;
  onClose: () => void;
};

export default function ManageCoordinatorsDialog({
  isOpen,
  coordinators,
  onAdd,
  onRemove,
  onClose,
}: Props) {
  const [showNewPanel, setShowNewPanel] = useState(false);

  const onChangeDialogOpen = (newOpen: boolean) => {
    if (!newOpen) {
      if (showNewPanel) {
        setShowNewPanel(false);
      } else {
        onClose();
      }
    }
  };

  const handleAdd = (coordinator: CoordinatorDescriptor) => {
    onAdd(coordinator);
    setShowNewPanel(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[700px] flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-widest">Manage Coordinators</h2>

        <ExistingCoordinatorsPanel coordinators={coordinators} onRemove={onRemove} />

        <Popover open={showNewPanel}>
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
      </DialogContent>
    </Dialog>
  );
}
