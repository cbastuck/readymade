import { ReactNode, useId, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

import Editor from "hkp-frontend/src/components/shared/Editor/index";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

type Action = { label: string; onAction: (buf: string | object) => void };
type Props = {
  title: string;
  description?: string;
  value: string | object;
  isOpen: boolean;
  additionalHeaderButtons?: Array<any>;
  actions?: Array<Action>;
  autofocus?: boolean;
  children?: ReactNode;
  onClose: () => void;
};

export default function EditorDialog({
  title,
  description,
  value,
  isOpen,
  additionalHeaderButtons,
  actions,
  autofocus,
  children,
  onClose,
}: Props) {
  const editor = useRef<any>(null);
  const descriptionId = useId();
  if (!isOpen) {
    return null;
  }

  const onChangeDialogOpen = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const onButton = (action: Action) => {
    const newValue = editor.current?.getValue();
    if (newValue) {
      if (typeof value === "string") {
        action.onAction(newValue);
      } else {
        action.onAction(JSON.parse(newValue));
      }
    }
  };

  const avoidDefaultDomBehavior = (e: Event) => {
    e.preventDefault();
  };

  const v = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent
        className="sm:max-w-[80%] h-[80%] flex flex-col overflow-scroll"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
        additionalHeaderButtons={additionalHeaderButtons}
        aria-describedby={description ? descriptionId : undefined}
      >
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription id={descriptionId} className="sr-only">
            {description}
          </DialogDescription>
        )}
        {children && <div>{children}</div>}
        <Editor ref={editor} value={v} language="json" autofocus={autofocus} />
        <DialogFooter className="flex">
          {actions?.map((action) => (
            <Button
              className="tracking-widest"
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
