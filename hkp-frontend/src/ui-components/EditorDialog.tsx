import { ReactNode, useId, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { SettingsButton } from "hkp-frontend/src/ui-components/settings/kit";

import Editor from "hkp-frontend/src/components/shared/Editor/index";
import "./editor-dialog.css";

type Action = { label: string; onAction: (buf: string | object) => void };
// Sizing inline rather than through utilities: it has to beat the primitive's
// own classes whatever order the stylesheets load in.
const frameStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "min(1280px, 92vw)",
  maxWidth: "none",
  height: "min(900px, 86vh)",
  padding: 0,
  gap: 0,
  overflow: "hidden",
  borderRadius: 16,
};

type Props = {
  title: string;
  description?: string;
  value: string | object;
  language?: string;
  isOpen: boolean;
  additionalHeaderButtons?: Array<any>;
  /** The first is the dialog's main action: drawn as primary, at the right. */
  actions?: Array<Action>;
  autofocus?: boolean;
  /** Shows the value without letting it be edited. */
  readOnly?: boolean;
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
  readOnly,
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

  const [mainAction, ...otherActions] = actions ?? [];
  // Room in the header for the buttons the primitive draws at its right.
  const headerPaddingRight = 56 + 32 * (additionalHeaderButtons?.length ?? 0);

  return (
    <Dialog open={isOpen} onOpenChange={onChangeDialogOpen}>
      <DialogContent
        className="hkp-set hkp-set-dialog hkp-edit-dialog"
        style={frameStyle}
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
        additionalHeaderButtons={additionalHeaderButtons}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div
          className="hkp-set-pane-header"
          style={{ paddingRight: headerPaddingRight }}
        >
          <DialogPrimitive.Title className="hkp-set-pane-title">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogDescription id={descriptionId} className="sr-only">
              {description}
            </DialogDescription>
          )}
        </div>

        {children && <div className="hkp-edit-dialog-details">{children}</div>}

        <div className="hkp-edit-dialog-editor">
          <Editor
            ref={editor}
            value={v}
            language={language || "json"}
            autofocus={autofocus}
            readOnly={readOnly}
          />
        </div>

        {mainAction && (
          <div className="hkp-edit-dialog-footer">
            {otherActions.map((action) => (
              <SettingsButton
                key={action.label}
                onClick={() => onButton(action)}
              >
                {action.label}
              </SettingsButton>
            ))}
            <SettingsButton
              variant="primary"
              onClick={() => onButton(mainAction)}
            >
              {mainAction.label}
            </SettingsButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
