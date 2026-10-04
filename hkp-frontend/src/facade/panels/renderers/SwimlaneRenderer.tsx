import {
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRightLeft, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "hkp-frontend/src/ui-components/primitives/dropdown-menu";
import { SwimlaneWidget, WidgetAction } from "../../types";
import { WidgetRendererProps } from "../widgetRegistry";
import { useNotificationValue } from "./StatusIndicatorRenderer";
import { resolvePath } from "../../readValue";
import { useWidgetActions } from "../../useWidgetActions";
import { interpolateTemplate } from "../../itemTemplate";
import { DraggedSwimlaneCard, useSwimlaneDrag } from "../../SwimlaneDragContext";
import { useFacadeState } from "../../FacadeStateContext";

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

const DEFAULT_SELECTION_STATE = "selection";

const field = (row: Row, name: string): unknown => resolvePath(row, name);
const same = (a: string | number, b: string | number) => String(a) === String(b);
const isCardId = (value: unknown): value is string | number =>
  typeof value === "string" || typeof value === "number";

/** Every card the source holds, whichever lane it belongs to. */
function cardsIn(widget: SwimlaneWidget, value: unknown): Card[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const idField = widget.cardIdField ?? "cardId";
  const laneField = widget.laneIdField ?? "laneId";
  const titleField = widget.titleField ?? "title";
  const descriptionField = widget.descriptionField ?? "description";
  const positionField = widget.positionField ?? "position";

  return value.flatMap((candidate, sourceIndex): Card[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }
    const row = candidate as Row;
    const id = field(row, idField);
    const laneId = field(row, laneField);
    if (!isCardId(id) || !isCardId(laneId)) {
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
  });
}

/** The cards of this widget's own lane, in the order they are shown. */
function cardsFor(widget: SwimlaneWidget, all: Card[]): Card[] {
  return all
    .filter((card) => same(card.laneId, widget.laneId))
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

// Where a card would land. Drawn in the space between two cards rather than
// between the cards themselves: a mark that took room would move the cards
// under the pointer, and the card it is over is what decides where the mark is.
const CARD_GAP = 8;
const DROP_MARK_HEIGHT = 3;
const dropMarkStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  height: DROP_MARK_HEIGHT,
  borderRadius: 2,
  background: "var(--hkp-accent, hsl(var(--primary)))",
  pointerEvents: "none",
} as const;
const DROP_MARK_OFFSET = -(CARD_GAP + DROP_MARK_HEIGHT) / 2;

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
  editorTitle,
  titleLabel,
  descriptionLabel,
  saveLabel,
  onClose,
  onSave,
}: {
  state: EditorState;
  laneTitle: string;
  editorTitle?: string;
  titleLabel?: string;
  descriptionLabel?: string;
  saveLabel?: string;
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
          {editorTitle ??
            (state?.mode === "edit" ? "Edit card" : `Add to ${laneTitle}`)}
        </DialogTitle>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {titleLabel ?? "Title"}
            <input
              autoFocus
              aria-label={titleLabel ?? "Card title"}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              style={{ ...controlStyle, padding: "9px 10px", cursor: "text" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {descriptionLabel ?? "Description"}
            <textarea
              aria-label={descriptionLabel ?? "Card description"}
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
              {saveLabel ?? (state?.mode === "edit" ? "Save" : "Add card")}
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
  const allCards = useMemo(() => cardsIn(widget, value), [widget, value]);
  const cards = useMemo(() => cardsFor(widget, allCards), [widget, allCards]);
  const { run, prompt } = useWidgetActions(boardContext);
  const { dragged, setDragged, targets, addTarget } = useSwimlaneDrag();
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  // Which card is selected is facade state rather than this lane's own: lanes
  // naming the same key hold one selection between them, and a button
  // elsewhere on the facade can act on it.
  const { state, setState } = useFacadeState();
  const selectionState = widget.selectionState ?? DEFAULT_SELECTION_STATE;
  const published = widget.selectable ? state[selectionState] : undefined;
  const selectedId = isCardId(published) ? published : undefined;
  const isSelected = (card: Card) =>
    selectedId !== undefined && same(card.id, selectedId);

  const toggleSelected = (card: Card) =>
    setState(selectionState, isSelected(card) ? undefined : card.id);

  // A selection outlives a move, because the card is still on the board, but
  // not a deletion. The lane that was showing the card is the one that notices
  // it gone, and it lets go only when its source no longer holds the card at
  // all — another lane of the same selection may be reading a different one.
  const shownRef = useRef(false);
  useEffect(() => {
    if (selectedId === undefined) {
      shownRef.current = false;
      return;
    }
    if (cards.some((card) => same(card.id, selectedId))) {
      shownRef.current = true;
      return;
    }
    if (shownRef.current) {
      shownRef.current = false;
      if (!allCards.some((card) => same(card.id, selectedId))) {
        setState(selectionState, undefined);
      }
    }
  }, [cards, allCards, selectedId, selectionState, setState]);

  // A click on the card selects it; one on a control inside the card is that
  // control's. A menu opened from the card is drawn elsewhere on the page but
  // still reports its clicks here, which is what the containment check is for.
  const onCardClick = (event: MouseEvent<HTMLElement>, card: Card) => {
    const target = event.target as HTMLElement;
    if (!event.currentTarget.contains(target) || target.closest("button")) {
      return;
    }
    toggleSelected(card);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, card: Card) => {
    if (
      event.target !== event.currentTarget ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }
    event.preventDefault();
    toggleSelected(card);
  };

  const group = widget.dragGroup ?? widget.source.serviceUuid;
  const canDrag = widget.allowDrag ?? !!widget.moveActions?.length;
  const canAccept = widget.acceptDrops ?? !!widget.moveActions?.length;
  const takesCards = canAccept && !!widget.moveActions?.length;
  const accepts = dragged?.group === group && takesCards;

  const act = (actions: WidgetAction[] | undefined, operation: Row, confirm?: string) =>
    run({
      actions: resolvedActions(actions, operation),
      confirm: confirm
        ? String(interpolateTemplate(confirm, operation) ?? "")
        : undefined,
    });

  const leaving = (card: Card): DraggedSwimlaneCard => ({
    group,
    cardId: card.id,
    fromLaneId: card.laneId,
    fromPosition: card.position,
    item: card.item,
  });

  const beginDrag = (event: DragEvent, card: Card) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(card.id));
    setDragged(leaving(card));
  };

  // Puts a card at an index of this lane, counted against the cards on screen.
  const place = (moved: DraggedSwimlaneCard, rawIndex: number) => {
    const sourceIndex = same(moved.fromLaneId, widget.laneId)
      ? cards.findIndex((card) => same(card.id, moved.cardId))
      : -1;
    // A target after the source is numbered against a list that still contains
    // the source. SQL receives the index in the destination after it is removed.
    const toPosition =
      sourceIndex >= 0 && rawIndex > sourceIndex ? rawIndex - 1 : rawIndex;

    if (sourceIndex < 0 || toPosition !== sourceIndex) {
      void act(widget.moveActions, {
        operation: "move",
        cardId: moved.cardId,
        fromLaneId: moved.fromLaneId,
        toLaneId: widget.laneId,
        fromPosition: moved.fromPosition,
        toPosition,
        card: moved.item,
      });
    }
  };

  // The index a card dropped at this height would take: before the first card
  // whose middle is below the pointer, and after the last one otherwise. Asked
  // of the lane as a whole, so the header, the space between two cards and the
  // cards themselves all answer the same question.
  const listRef = useRef<HTMLDivElement>(null);
  const indexAt = (clientY: number) => {
    const shown =
      listRef.current?.querySelectorAll<HTMLElement>("article[data-card-id]") ?? [];
    for (let index = 0; index < shown.length; index++) {
      const bounds = shown[index].getBoundingClientRect();
      if (clientY < bounds.top + bounds.height / 2) {
        return index;
      }
    }
    return cards.length;
  };

  const drop = () => {
    if (!dragged || dragged.group !== group || !widget.moveActions?.length) {
      setDropIndex(null);
      return;
    }
    place(dragged, dropIndex ?? cards.length);
    setDropIndex(null);
    setDragged(null);
  };

  // What the other lanes of the group call to send a card here. Held in a ref
  // so that the lane is listed once rather than again on every render: where a
  // card lands depends on the cards on screen, and those change all the time.
  const receiveRef = useRef<(moved: DraggedSwimlaneCard) => void>(() => {});
  receiveRef.current = (moved) => place(moved, cards.length);

  useEffect(() => {
    if (!takesCards) {
      return;
    }
    return addTarget({
      group,
      laneId: widget.laneId,
      title: widget.title,
      receive: (moved) => receiveRef.current(moved),
    });
  }, [addTarget, takesCards, group, widget.laneId, widget.title]);

  // Where a card of this lane can go without being dragged: the other lanes of
  // its group that take cards, and — where this lane takes them itself — one
  // place up or down.
  const destinations = canDrag
    ? targets.filter(
        (target) => target.group === group && !same(target.laneId, widget.laneId),
      )
    : [];
  const reorders = canDrag && takesCards && cards.length > 1;

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
          setDropIndex(indexAt(event.clientY));
        }}
        onDragLeave={(event) => {
          // Fired for every element the pointer leaves inside the lane too.
          // Where the host does not say what it moved on to, where the pointer
          // is decides whether the lane itself was left.
          const next = event.relatedTarget as Node | null;
          const bounds = event.currentTarget.getBoundingClientRect();
          const inside = next
            ? event.currentTarget.contains(next)
            : event.clientX >= bounds.left &&
              event.clientX <= bounds.right &&
              event.clientY >= bounds.top &&
              event.clientY <= bounds.bottom;
          if (!inside) {
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
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 80,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: CARD_GAP,
            padding: 8,
            // The lane a card is over, for as long as it is over it; where in
            // the lane it would land is the mark between the cards.
            outline: accepts && dropIndex !== null ? "2px solid var(--hkp-accent, hsl(var(--primary)))" : undefined,
            outlineOffset: -3,
          }}
        >
          {cards.length === 0 ? (
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
            <div key={card.id} style={{ position: "relative" }}>
              {accepts && dropIndex === index ? (
                <div
                  data-testid={`drop-${String(widget.laneId)}-${index}`}
                  style={{ ...dropMarkStyle, top: DROP_MARK_OFFSET }}
                />
              ) : null}
              {accepts && dropIndex === cards.length && index === cards.length - 1 ? (
                <div
                  data-testid={`drop-${String(widget.laneId)}-end`}
                  style={{ ...dropMarkStyle, bottom: DROP_MARK_OFFSET }}
                />
              ) : null}
              <article
                draggable={canDrag}
                data-card-id={String(card.id)}
                {...(widget.selectable
                  ? {
                      tabIndex: 0,
                      "aria-current": isSelected(card) ? ("true" as const) : undefined,
                      onClick: (event: MouseEvent<HTMLElement>) => onCardClick(event, card),
                      onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
                        onCardKeyDown(event, card),
                    }
                  : {})}
                onDragStart={(event) => beginDrag(event, card)}
                onDragEnd={() => {
                  setDropIndex(null);
                  setDragged(null);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: canDrag
                    ? "18px minmax(0, 1fr) auto"
                    : "minmax(0, 1fr) auto",
                  alignItems: "start",
                  gap: 6,
                  padding: "9px 8px",
                  border: isSelected(card)
                    ? "1px solid var(--hkp-accent, hsl(var(--primary)))"
                    : "1px solid hsl(var(--border))",
                  borderRadius: 7,
                  background: "hsl(var(--card))",
                  boxShadow: isSelected(card)
                    ? "0 0 0 1px var(--hkp-accent, hsl(var(--primary)))"
                    : "0 1px 2px rgb(0 0 0 / 0.08)",
                  opacity: dragged?.group === group && same(dragged.cardId, card.id) ? 0.45 : 1,
                  cursor: canDrag ? "grab" : widget.selectable ? "pointer" : "default",
                }}
              >
                {canDrag ? (
                  <GripVertical
                    size={15}
                    aria-hidden="true"
                    style={{ marginTop: 2, color: "hsl(var(--muted-foreground))" }}
                  />
                ) : null}
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
                  {destinations.length || reorders ? (
                    // Not modal: a move may ask for confirmation, and that
                    // dialog opens while this menu is still closing.
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Move ${card.title}`}
                          title="Move card"
                          style={{ ...controlStyle, width: 26, height: 26, display: "grid", placeItems: "center", borderColor: "transparent" }}
                        >
                          <ArrowRightLeft size={13} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {destinations.map((target) => (
                          <DropdownMenuItem
                            key={String(target.laneId)}
                            onSelect={() => target.receive(leaving(card))}
                          >
                            Move to {target.title}
                          </DropdownMenuItem>
                        ))}
                        {reorders ? (
                          <>
                            <DropdownMenuItem
                              disabled={index === 0}
                              onSelect={() => place(leaving(card), index - 1)}
                            >
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={index === cards.length - 1}
                              // Counted against a list that still holds the
                              // card: below the next one is two places on.
                              onSelect={() => place(leaving(card), index + 2)}
                            >
                              Move down
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
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
        </div>
      </section>
      <CardEditor
        key={editor ? `${editor.mode}:${editor.mode === "edit" ? editor.card.id : "new"}` : "closed"}
        state={editor}
        laneTitle={widget.title}
        editorTitle={widget.editorTitle}
        titleLabel={widget.titleLabel}
        descriptionLabel={widget.descriptionLabel}
        saveLabel={widget.saveLabel}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      {prompt}
    </>
  );
}
