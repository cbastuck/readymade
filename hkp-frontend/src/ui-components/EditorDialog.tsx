import { ReactNode, useId, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

import Editor from "hkp-frontend/src/components/shared/Editor/index";

type Action = { label: string; onAction: (buf: string | object) => void };
type Props = {
  title: string;
  description?: string;
  value: string | object;
  language?: string;
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
  language,
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

  const onChangeDialogOpen = (open: boolean) => {
    if (!open) {
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
        className="flex h-[80vh] w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden p-0"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
        additionalHeaderButtons={additionalHeaderButtons}
        aria-describedby={description ? descriptionId : undefined}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-16">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription id={descriptionId} className="sr-only">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Optional content slot */}
        {children && (
          <div className="shrink-0 px-4 py-2 text-sm text-muted-foreground">
            {children}
          </div>
        )}

        {/* Editor — fills remaining space */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Editor
            ref={editor}
            value={v}
            language={language || "json"}
            autofocus={autofocus}
          />
        </div>

        {actions && actions.length > 0 && (
          <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={() => onButton(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
