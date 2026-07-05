import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import { RuntimeClass } from "hkp-frontend/src/types";

import ManageRuntimesContent from "./ManageRuntimesContent";

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
  const onChangeDialogOpen = (newOpen: boolean) => {
    if (!newOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[825px] h-[80vh] flex flex-col overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>Manage runtimes</DialogTitle>
        </DialogHeader>
        <ManageRuntimesContent
          remoteRuntimes={remoteRuntimes}
          onRemoveRuntimeEngine={onRemoveRuntimeEngine}
          onAddRuntimeEngine={onAddRuntimeEngine}
          onUpdateRuntimeEngine={onUpdateRuntimeEngine}
        />
      </DialogContent>
    </Dialog>
  );
}
