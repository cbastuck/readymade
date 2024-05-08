import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/ui-components/primitives/dialog";

import Editor from "@/components/shared/Editor/index";
import { Button } from "@/ui-components/primitives/button";

type Action = { label: string; onAction: (buf: string) => void };
type Props = {
  title: string;
  value: string;
  isOpen: boolean;
  actions: Array<Action>;
  onClose: () => void;
};

export default function EditorDialog({
  title,
  value,
  isOpen,
  actions,
  onClose,
}: Props) {
  const editor = useRef<any>(null);

  const onChangeDialogOpen = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const onButton = (action: Action) => {
    const value = editor.current?.getValue();
    if (value) {
      action.onAction(value);
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
        <h2>{title}</h2>
        <Editor ref={editor} value={value} language="json" />
        <DialogFooter className="flex">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              onClick={() => onButton(action)}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
