import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { CoordinatorDescriptor } from "../../common";
import ManageCoordinatorsContent from "./ManageCoordinatorsContent";

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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[700px] flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-widest">
          Manage Coordinators
        </h2>

        <ManageCoordinatorsContent
          coordinators={coordinators}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </DialogContent>
    </Dialog>
  );
}
