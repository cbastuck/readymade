import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

import Editor from "@/components/shared/Editor/index";
import { useRef } from "react";
import { filterPrivateMembers } from "@/runtime/browser/services/helpers";
import { ServiceDescriptor } from "@/types";
import { Button } from "@/components/ui/button";

type Props = {
  service: ServiceDescriptor;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newConfig: string) => void;
};

export default function ServiceConfigDialog({
  service,
  isOpen,
  onClose,
  onApply,
}: Props) {
  const editor = useRef<any>(null);

  const onChangeDialogOpen = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const onApplyConfig = () => {
    const value = editor.current?.getValue();
    if (value) {
      onApply(value);
    }
  };
  const { uuid, board, ...filteredService } = filterPrivateMembers(service);
  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent className="sm:max-w-[525px] h-[80%] flex flex-col">
        <h2>Service Configuration</h2>
        <Editor
          ref={editor}
          value={JSON.stringify(filteredService, null, 2)}
          language="json"
        />
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onApplyConfig}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
