import { DragEvent, FormEvent, useMemo, useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import { SwimlaneWidget, WidgetAction } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useNotificationValue } from "./StatusIndicatorRenderer";
import { resolvePath } from "../../readValue";
import { useWidgetActions } from "../../useWidgetActions";
import { interpolateTemplate } from "../../itemTemplate";
import { useSwimlaneDrag } from "../../SwimlaneDragContext";

type Row = Record<string, unknown>;

type Card = {
  id: string | number;
  laneId: string | number;
  title: string;
  description: string;
  position: number;
  item: Row;
};

type EditorState =
  | { mode: "create"; card: null }
  | { mode: "edit"; card: Card }
  | null;

const field = (row: Row, name: string): unknown => resolvePath(row, name);
const same = (a: string | number, b: string | number) => String(a) === String(b);

function cardsFor(widget: SwimlaneWidget, value: unknown): Card[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const idField = widget.cardIdField ?? "cardId";
  const laneField = widget.laneIdField ?? "laneId";
  const titleField = widget.titleField ?? "title";
  const descriptionField = widget.descriptionField ?? "description";
  const positionField = widget.positionField ?? "position";

  return value
    .flatMap((candidate, sourceIndex): Card[] => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        return [];
      }
      const row = candidate as Row;
      const id = field(row, idField);
      const laneId = field(row, laneField);
      if (
        (typeof id !== "string" && typeof id !== "number") ||
        (typeof laneId !== "string" && typeof laneId !== "number") ||
        !same(laneId, widget.laneId)
      ) {
        return [];
      }
      const rawPosition = field(row, positionField);
      return [
        {
          id,
          laneId,
          title: String(field(row, titleField) ?? ""),
          description: String(field(row, descriptionField) ?? ""),
          position:
            typeof rawPosition === "number" && Number.isFinite(rawPosition)
              ? rawPosition
              : sourceIndex,
          item: row,
        },
      ];
    })
    .sort((a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id)));
}

function resolvedActions(
  actions: WidgetAction[] | undefined,
  operation: Row,
): WidgetAction[] | undefined {
  return actions
    ? (interpolateTemplate(actions, operation) as WidgetAction[])
    : undefined;
}

const controlStyle = {
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  cursor: "pointer",
} as const;

function CardEditor({
  state,
  laneTitle,
  onClose,
  onSave,
}: {
  state: EditorState;
  laneTitle: string;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
}) {
  // The dialog is keyed by its caller, so these are the values for this
  // opening rather than stale input from the card edited before it.
  const initialTitle = state?.mode === "edit" ? state.card.title : "";
  const initialDescription =
    state?.mode === "edit" ? state.card.description : "";
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    onSave(nextTitle, description.trim());
  };

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle>
          {state?.mode === "edit" ? "Edit card" : `Add to ${laneTitle}`}
        </DialogTitle>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            Title
            <input
              autoFocus
              aria-label="Card title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              style={{ ...controlStyle, padding: "9px 10px", cursor: "text" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            Description
            <textarea
              aria-label="Card description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              style={{
                ...controlStyle,
                padding: "9px 10px",
                cursor: "text",
                resize: "vertical",
              }}
            />
          </label>
          <DialogFooter>
            <button type="button" onClick={onClose} style={{ ...controlStyle, padding: "8px 14px" }}>
              Cancel
            </button>
            <button
              type="submit"
              style={{
                ...controlStyle,
                padding: "8px 14px",
                borderColor: "transparent",
                background: "var(--hkp-accent, hsl(var(--primary)))",
                color: "hsl(var(--primary-foreground))",
                fontWeight: 600,
              }}
            >
              {state?.mode === "edit" ? "Save" : "Add card"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SwimlaneRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<SwimlaneWidget>) {
  const value = useNotificationValue(boardContext, widget.source);
  const cards = useMemo(() => cardsFor(widget, value), [widget, value]);
  const { run, prompt } = useWidgetActions(boardContext);
  const { dragged, setDragged } = useSwimlaneDrag();
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const group = widget.dragGroup ?? widget.source.serviceUuid;
  const accepts = dragged?.group === group && !!widget.moveActions?.length;

  const act = (actions: WidgetAction[] | undefined, operation: Row, confirm?: string) =>
    run({
      actions: resolvedActions(actions, operation),
      confirm: confirm
        ? String(interpolateTemplate(confirm, operation) ?? "")
        : undefined,
    });

  const beginDrag = (event: DragEvent, card: Card) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(card.id));
    setDragged({
      group,
      cardId: card.id,
      fromLaneId: card.laneId,
      fromPosition: card.position,
      item: card.item,
    });
  };

  const drop = () => {
    if (!dragged || dragged.group !== group || !widget.moveActions?.length) {
      setDropIndex(null);
      return;
    }
    const rawIndex = dropIndex ?? cards.length;
    const sourceIndex = same(dragged.fromLaneId, widget.laneId)
      ? cards.findIndex((card) => same(card.id, dragged.cardId))
      : -1;
    // A target after the source is numbered against a list that still contains
    // the source. SQL receives the index in the destination after it is removed.
    const toPosition =
      sourceIndex >= 0 && rawIndex > sourceIndex ? rawIndex - 1 : rawIndex;

    if (sourceIndex < 0 || toPosition !== sourceIndex) {
      void act(widget.moveActions, {
        operation: "move",
        cardId: dragged.cardId,
        fromLaneId: dragged.fromLaneId,
        toLaneId: widget.laneId,
        fromPosition: dragged.fromPosition,
        toPosition,
        card: dragged.item,
      });
    }
    setDropIndex(null);
    setDragged(null);
  };

  const save = (title: string, description: string) => {
    if (!editor) {
      return;
    }
    if (editor.mode === "create") {
      void act(widget.createActions, {
        operation: "create",
        laneId: widget.laneId,
        title,
        description,
      });
    } else {
      void act(widget.editActions, {
        operation: "edit",
        cardId: editor.card.id,
        laneId: editor.card.laneId,
        title,
        description,
        card: editor.card.item,
      });
    }
    setEditor(null);
  };

  return (
    <>
      <section
        aria-label={widget.title}
        onDragOver={(event) => {
          if (!accepts) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropIndex(cards.length);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropIndex(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop();
        }}
        style={{
          width: widget.width ?? 280,
          minWidth: widget.minWidth ?? 230,
          maxHeight: widget.maxHeight,
          display: "flex",
          flexDirection: "column",
          alignSelf: "stretch",
          overflow: "hidden",
          border: "1px solid hsl(var(--border))",
          borderRadius: 10,
          background: "hsl(var(--muted) / 0.55)",
        }}
      >
        <header
          style={{
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <strong style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{widget.title}</strong>
          <span
            aria-label={`${cards.length} cards`}
            style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
          >
            {cards.length}
          </span>
          {widget.allowCreate && widget.createActions?.length ? (
            <button
              type="button"
              aria-label={`Add card to ${widget.title}`}
              title="Add card"
              onClick={() => setEditor({ mode: "create", card: null })}
              style={{ ...controlStyle, width: 28, height: 28, display: "grid", placeItems: "center" }}
            >
              <Plus size={15} />
            </button>
          ) : null}
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 80,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 8,
            outline: accepts && dropIndex === cards.length ? "2px solid var(--hkp-accent, hsl(var(--primary)))" : undefined,
            outlineOffset: -3,
          }}
        >
          {cards.length === 0 && dropIndex !== 0 ? (
            <div
              style={{
                minHeight: 72,
                display: "grid",
                placeItems: "center",
                padding: 12,
                textAlign: "center",
                fontSize: 11,
                color: "hsl(var(--muted-foreground))",
                border: "1px dashed hsl(var(--border))",
                borderRadius: 7,
              }}
            >
              {widget.emptyLabel ?? "No cards"}
            </div>
          ) : null}

          {cards.map((card, index) => (
            <div key={card.id}>
              {dropIndex === index ? (
                <div
                  data-testid={`drop-${String(widget.laneId)}-${index}`}
                  style={{ height: 3, borderRadius: 2, background: "var(--hkp-accent, hsl(var(--primary)))", marginBottom: 8 }}
                />
              ) : null}
              <article
                draggable={!!widget.moveActions?.length}
                data-card-id={String(card.id)}
                onDragStart={(event) => beginDrag(event, card)}
                onDragEnd={() => {
                  setDropIndex(null);
                  setDragged(null);
                }}
                onDragOver={(event) => {
                  if (!accepts) {
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  setDropIndex(event.clientY < bounds.top + bounds.height / 2 ? index : index + 1);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px minmax(0, 1fr) auto",
                  alignItems: "start",
                  gap: 6,
                  padding: "9px 8px",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 7,
                  background: "hsl(var(--card))",
                  boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)",
                  opacity: dragged?.group === group && same(dragged.cardId, card.id) ? 0.45 : 1,
                  cursor: widget.moveActions?.length ? "grab" : "default",
                }}
              >
                <GripVertical
                  size={15}
                  aria-hidden="true"
                  style={{ marginTop: 2, color: "hsl(var(--muted-foreground))" }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflowWrap: "anywhere" }}>
                    {card.title || "Untitled card"}
                  </div>
                  {card.description ? (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 11,
                        lineHeight: 1.35,
                        color: "hsl(var(--muted-foreground))",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {card.description}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {widget.editActions?.length ? (
                    <button
                      type="button"
                      aria-label={`Edit ${card.title}`}
                      title="Edit card"
                      onClick={() => setEditor({ mode: "edit", card })}
                      style={{ ...controlStyle, width: 26, height: 26, display: "grid", placeItems: "center", borderColor: "transparent" }}
                    >
                      <Pencil size={13} />
                    </button>
                  ) : null}
                  {widget.deleteActions?.length ? (
                    <button
                      type="button"
                      aria-label={`Delete ${card.title}`}
                      title="Delete card"
                      onClick={() => {
                        const operation = {
                          operation: "delete",
                          cardId: card.id,
                          laneId: card.laneId,
                          title: card.title,
                          description: card.description,
                          card: card.item,
                        };
                        void act(
                          widget.deleteActions,
                          operation,
                          widget.deleteConfirm ?? "Delete “{{item.title}}”?",
                        );
                      }}
                      style={{ ...controlStyle, width: 26, height: 26, display: "grid", placeItems: "center", borderColor: "transparent", color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              </article>
            </div>
          ))}
          {dropIndex === cards.length && cards.length > 0 ? (
            <div
              data-testid={`drop-${String(widget.laneId)}-end`}
              style={{ height: 3, borderRadius: 2, background: "var(--hkp-accent, hsl(var(--primary)))" }}
            />
          ) : null}
        </div>
      </section>
      <CardEditor
        key={editor ? `${editor.mode}:${editor.mode === "edit" ? editor.card.id : "new"}` : "closed"}
        state={editor}
        laneTitle={widget.title}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      {prompt}
    </>
  );
}
