import { useRef, useState } from "react";

import { artFor, gradient, stateMeta } from "./model";
import { BoardArt, BoardHistoryItem, BoardNode } from "./types";

/** Preset swatches for the artwork picker: solids and matching gradients. */
const ART_COLORS = ["#3b5bff", "#17b877", "#f2a417", "#e0355f", "#5b5b6b"];
const ART_GRADIENTS: Array<[string, string]> = [
  ["#3b5bff", "#6a3bff"],
  ["#17b877", "#0a8a72"],
  ["#f2a417", "#c76a00"],
  ["#e0355f", "#a01040"],
  ["#2fb6c9", "#1f7d9a"],
];

interface Props {
  board: BoardNode;
  /** Resolved description (host-loaded for saved boards). */
  description?: string;
  /** Current custom artwork; enables the artwork editor together with
   *  onChangeArt. */
  art?: BoardArt;
  /** Sets (or clears, with null) the board's artwork. */
  onChangeArt?: (art: BoardArt | null) => void;
  /** Uploads an image and files it as the board's artwork. */
  onUploadImage?: (image: Blob) => Promise<void>;
  /** Host-provided image picker (native file dialog). When set, "Upload
   *  image…" calls this instead of the hidden <input type="file"> — needed in
   *  webviews that don't open a panel for file inputs (Meander/saucer). */
  pickImage?: () => Promise<Blob | null>;
  onOpen?: () => void;
  /** Uploads the board to the user's cloud storage; enables the
   *  "Upload to cloud" action (hosts pass it for logged-in users only). */
  onUploadToCloud?: () => Promise<void>;
  /** Loads the board's saved versions; enables the collapsible History
   *  section. Fetched lazily on first expand. */
  loadHistory?: () => Promise<BoardHistoryItem[]>;
  /** Unfiles the board from the folder it is selected in. */
  onRemoveFromFolder?: () => void;
  /** Deletes the board entirely; asked to confirm with a second click. */
  onDelete?: () => void;
  /** Revokes a share recipient's access (owner side); renders the board's
   *  sharedWith list with a Revoke action per entry. */
  onRevokeShare?: (email: string) => Promise<void>;
  /** Removes the user from a board shared with them (viewer side); asked to
   *  confirm with a second click. */
  onLeaveShare?: () => Promise<void>;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistorySection({
  loadHistory,
}: {
  loadHistory: () => Promise<BoardHistoryItem[]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<BoardHistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) {
      loadHistory()
        .then(setItems)
        .catch(() => setFailed(true));
    }
  };

  return (
    <div style={{ width: "100%", flex: "0 0 auto" }}>
      <button
        className="st-btn st-btn-ghost"
        style={{ justifyContent: "center", width: "100%" }}
        onClick={toggle}
      >
        {expanded ? "Close History" : "Open History"}
        {items !== null && ` (${items.length})`}
      </button>

      {/* No own scrollbar — the list unfolds into the details panel, which
          scrolls as a whole. */}
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {failed && (
            <div style={{ fontSize: 12, color: "#e0355f" }}>
              Could not load the history.
            </div>
          )}
          {!failed && items === null && (
            <div style={{ fontSize: 12, color: "#9a9fae" }}>Loading…</div>
          )}
          {items !== null && items.length === 0 && (
            <div style={{ fontSize: 12, color: "#9a9fae" }}>
              No saved versions yet.
            </div>
          )}
          {items?.map((item, index) => (
            <div
              key={`${item.timestamp}-${index}`}
              className="st-row"
              style={{ padding: "4px 6px" }}
              onClick={item.open}
              title="Open this version"
            >
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {formatTimestamp(item.timestamp)}
                </span>
                {item.label && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#9a9fae",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </div>
              <button
                className="st-open"
                onClick={(e) => {
                  e.stopPropagation();
                  item.open();
                }}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function artEquals(a: BoardArt | undefined, b: BoardArt): boolean {
  if (!a || a.kind !== b.kind) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function ArtSwatch({
  background,
  selected,
  title,
  onClick,
}: {
  background: string;
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 7,
        background,
        border: "2px solid #fff",
        boxShadow: selected
          ? "0 0 0 2px var(--st-accent)"
          : "0 0 0 1px #dfe2e9",
        cursor: "pointer",
        padding: 0,
        flex: "0 0 auto",
      }}
    />
  );
}

/**
 * Finder-style details column for the selected board: artwork, name, state,
 * description, and the actions that apply to it.
 */
export default function BoardDetails({
  board,
  description,
  art,
  onChangeArt,
  onUploadImage,
  pickImage,
  onOpen,
  onUploadToCloud,
  loadHistory,
  onRemoveFromFolder,
  onDelete,
  onRevokeShare,
  onLeaveShare,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudState, setCloudState] = useState<
    "idle" | "busy" | "done" | "error"
  >("idle");
  const [cloudError, setCloudError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const meta = stateMeta(board.state);

  const reasonOf = (err: unknown): string =>
    err instanceof Error && err.message ? err.message : "Please try again.";

  const uploadImage = async (image: Blob | null | undefined) => {
    if (!image || !onUploadImage) {
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await onUploadImage(image);
    } catch (err) {
      setUploadError(reasonOf(err));
    } finally {
      setUploading(false);
    }
  };

  const revokeShare = async (email: string) => {
    if (!onRevokeShare || shareBusy) {
      return;
    }
    setShareBusy(email);
    setShareError(null);
    try {
      await onRevokeShare(email);
    } catch (err) {
      setShareError(reasonOf(err));
    } finally {
      setShareBusy(null);
    }
  };

  const leaveShare = async () => {
    if (!onLeaveShare || shareBusy) {
      return;
    }
    setShareBusy("__leave__");
    setShareError(null);
    try {
      await onLeaveShare();
    } catch (err) {
      setShareError(reasonOf(err));
    } finally {
      setShareBusy(null);
      setConfirmingLeave(false);
    }
  };

  const uploadToCloud = async () => {
    if (!onUploadToCloud || cloudState === "busy") {
      return;
    }
    setCloudState("busy");
    setCloudError(null);
    try {
      await onUploadToCloud();
      setCloudState("done");
    } catch (err) {
      setCloudError(reasonOf(err));
      setCloudState("error");
    }
  };

  const startImagePick = async () => {
    if (pickImage) {
      try {
        await uploadImage(await pickImage());
      } catch (err) {
        setUploadError(reasonOf(err));
      }
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div
      style={{
        flex: "0 0 300px",
        width: 300,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          padding: "13px 14px 11px",
          borderBottom: "1px solid #eceef3",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--st-mut)",
          }}
        >
          Details
        </span>
      </div>

      <div
        className="st-v"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 18,
            background: board.art ?? artFor(board.name),
            flex: "0 0 auto",
          }}
        />

        <div style={{ textAlign: "center", minWidth: 0, width: "100%" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {board.name}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7080",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: meta.dot,
              }}
            />
            {board.by ? `${meta.label} · ${board.by}` : meta.label}
          </div>
        </div>

        {description && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#6b7080",
              textAlign: "center",
            }}
          >
            {description}
          </p>
        )}

        {onChangeArt && (
          <div style={{ width: "100%", flex: "0 0 auto" }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--st-mut)",
                marginBottom: 8,
              }}
            >
              Artwork
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 6,
              }}
            >
              {ART_COLORS.map((color) => (
                <ArtSwatch
                  key={color}
                  background={color}
                  title={color}
                  selected={artEquals(art, { kind: "color", color })}
                  onClick={() => onChangeArt({ kind: "color", color })}
                />
              ))}
              {ART_GRADIENTS.map(([from, to]) => (
                <ArtSwatch
                  key={`${from}-${to}`}
                  background={gradient(from, to)}
                  title={`${from} → ${to}`}
                  selected={artEquals(art, { kind: "gradient", from, to })}
                  onClick={() => onChangeArt({ kind: "gradient", from, to })}
                />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
              }}
            >
              {onUploadImage && (
                <>
                  {!pickImage && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        void uploadImage(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  )}
                  <button
                    className="st-btn st-btn-ghost"
                    style={{ fontSize: 12.5, padding: "6px 11px" }}
                    disabled={uploading}
                    onClick={() => void startImagePick()}
                  >
                    {uploading ? "Uploading…" : "Upload image…"}
                  </button>
                </>
              )}
              {art && (
                <button
                  className="st-btn st-btn-ghost"
                  style={{ fontSize: 12.5, padding: "6px 11px" }}
                  onClick={() => onChangeArt(null)}
                >
                  Reset
                </button>
              )}
            </div>
            {uploadError && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#e0355f" }}>
                Upload failed — {uploadError}
              </div>
            )}
          </div>
        )}

        {board.sharedWith && board.sharedWith.length > 0 && (
          <div style={{ width: "100%", flex: "0 0 auto" }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--st-mut)",
                marginBottom: 8,
              }}
            >
              Shared with
            </div>
            {board.sharedWith.map((email) => (
              <div
                key={email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                }}
              >
                <span
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    fontSize: 12.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </span>
                {onRevokeShare && (
                  <button
                    type="button"
                    disabled={shareBusy !== null}
                    onClick={() => void revokeShare(email)}
                    style={{
                      flex: "0 0 auto",
                      border: "none",
                      background: "none",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#e0355f",
                      cursor: shareBusy !== null ? "default" : "pointer",
                      opacity: shareBusy !== null ? 0.5 : 1,
                      padding: "2px 4px",
                    }}
                  >
                    {shareBusy === email ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
            {shareError && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#e0355f" }}>
                {shareError}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: "1 1 auto" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            flex: "0 0 auto",
          }}
        >
          {onOpen && (
            <button
              className="st-btn st-btn-primary"
              style={{ justifyContent: "center" }}
              onClick={onOpen}
            >
              Open board
            </button>
          )}
          {onUploadToCloud && (
            <>
              <button
                className="st-btn st-btn-ghost"
                style={{ justifyContent: "center" }}
                disabled={cloudState === "busy"}
                onClick={() => void uploadToCloud()}
              >
                {cloudState === "busy"
                  ? "Uploading…"
                  : cloudState === "done"
                    ? "Uploaded to cloud ✓"
                    : "Upload to cloud"}
              </button>
              {cloudState === "error" && cloudError && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#e0355f",
                    textAlign: "center",
                  }}
                >
                  Upload failed — {cloudError}
                </div>
              )}
            </>
          )}
          {onRemoveFromFolder && (
            <button
              className="st-btn st-btn-ghost"
              style={{ justifyContent: "center" }}
              onClick={onRemoveFromFolder}
            >
              Remove from folder
            </button>
          )}
          {onLeaveShare && (
            <>
              {confirmingLeave ? (
                <button
                  className="st-btn st-btn-ghost"
                  style={{
                    justifyContent: "center",
                    color: "#e0355f",
                    borderColor: "#e0355f",
                  }}
                  disabled={shareBusy !== null}
                  onClick={() => void leaveShare()}
                >
                  {shareBusy === "__leave__"
                    ? "Removing…"
                    : `Really leave “${board.name}”?`}
                </button>
              ) : (
                <button
                  className="st-btn st-btn-ghost"
                  style={{ justifyContent: "center", color: "#e0355f" }}
                  onClick={() => setConfirmingLeave(true)}
                >
                  Remove me from this board
                </button>
              )}
              {shareError && !board.sharedWith?.length && (
                <div
                  style={{ fontSize: 12, color: "#e0355f", textAlign: "center" }}
                >
                  {shareError}
                </div>
              )}
            </>
          )}
          {onDelete &&
            (confirmingDelete ? (
              <button
                className="st-btn st-btn-ghost"
                style={{
                  justifyContent: "center",
                  color: "#e0355f",
                  borderColor: "#e0355f",
                }}
                onClick={onDelete}
              >
                Really delete “{board.name}”?
              </button>
            ) : (
              <button
                className="st-btn st-btn-ghost"
                style={{ justifyContent: "center", color: "#e0355f" }}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete board
              </button>
            ))}
        </div>

        {/* Last on purpose: the unfolded history can get long and scrolls
            with the whole panel, below the always-reachable actions. */}
        {loadHistory && <HistorySection loadHistory={loadHistory} />}
      </div>
    </div>
  );
}
