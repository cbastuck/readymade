import { ReactNode, useId, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

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

const btnBase: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1.5px solid var(--border-mid, #d5d0c8)",
  background: "none",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  color: "var(--text-mid, #666)",
  transition: "background 0.15s, color 0.15s",
  whiteSpace: "nowrap" as const,
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
        style={{
          padding: 0,
          background: "var(--bg-card, white)",
          border: "1px solid var(--border, #e2ddd7)",
          borderRadius: 16,
          boxShadow:
            "0 4px 24px oklch(0.4 0.01 280 / 0.12), 0 1px 4px oklch(0.4 0.01 280 / 0.06)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          width: "80vw",
          maxWidth: "80vw",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        className="sm:max-w-[80%]"
        onPointerDownOutside={avoidDefaultDomBehavior}
        onInteractOutside={avoidDefaultDomBehavior}
        additionalHeaderButtons={additionalHeaderButtons}
        aria-describedby={description ? descriptionId : undefined}
      >
        {/* Header */}
        <div
          style={{
            padding: "13px 60px 13px 16px",
            borderBottom: "1px solid var(--border, #e2ddd7)",
            flexShrink: 0,
          }}
        >
          <DialogTitle
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text, #1a1a1a)",
              letterSpacing: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription id={descriptionId} className="sr-only">
              {description}
            </DialogDescription>
          )}
        </div>

        {/* Optional content slot */}
        {children && (
          <div
            style={{
              padding: "10px 16px 0",
              flexShrink: 0,
              fontSize: 13,
              color: "var(--text-mid, #666)",
            }}
          >
            {children}
          </div>
        )}

        {/* Editor — fills remaining space */}
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <Editor
            ref={editor}
            value={v}
            language={language || "json"}
            autofocus={autofocus}
          />
        </div>

        {/* Footer */}
        {actions && actions.length > 0 && (
          <div
            style={{
              padding: "11px 16px",
              borderTop: "1px solid var(--border, #e2ddd7)",
              display: "flex",
              gap: 6,
              justifyContent: "flex-end",
              flexShrink: 0,
            }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onButton(action)}
                style={btnBase}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--border, #e2ddd7)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--text, #1a1a1a)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "none";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "var(--text-mid, #666)";
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
