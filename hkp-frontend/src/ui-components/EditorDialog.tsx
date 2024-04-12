import { useRef } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

import Editor from "@/components/shared/Editor/index";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (newValue: string) => void;
};

export default function EditorDialog({
  value,
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

  const avoidDefaultDomBehavior = (e: Event) => {
    e.preventDefault();
  };
  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent
        className="sm:max-w-[80%] h-[80%] flex flex-col"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
      >
        <h2>Service Configuration</h2>
        <Editor ref={editor} value={value} language="json" />
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
