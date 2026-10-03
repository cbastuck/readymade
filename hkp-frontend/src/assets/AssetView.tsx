/**
 * The board's assets, as a view of their own.
 *
 * A third way of looking at a board, beside its runtimes and the overview:
 * content the board declares once and its services name as `hkp-asset://<id>`.
 * On the left, every asset — name, id, media type, where its content is, and
 * how large it is. On the right, the one being edited:
 *
 * - **Inline text** in a code editor highlighted by its media type. Nothing is
 *   pushed as it is typed — a page served half-written is worse than a stale
 *   one — so a change takes effect on **Apply**, which pushes the descriptor to
 *   the runtimes referencing it. They serve it on their next use; nothing is
 *   reconfigured. A runtime that did not take it is named, and Apply stays
 *   available to send it again.
 * - **A URL** as a descriptor: where the content is, fetched by each runtime
 *   using it.
 * - **Given to**: every runtime of the board, including one added later, or
 *   only the ones ticked.
 * - **Used by**: every service whose state names the asset, found by a scan
 *   for the scheme over what the services hold now, each a way to that
 *   service.
 *
 * Renaming rewrites every reference; deleting one still referenced asks first.
 * A draft is of the board that is open: it is dropped when another board
 * replaces that one. See `runtime/board/assets`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CornerUpRight, FilePlus2, Link2, Trash2, Upload } from "lucide-react";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";

import { useBoardContext } from "hkp-frontend/src/BoardContext";
import Editor from "hkp-frontend/src/components/shared/Editor";
import CopyButton from "hkp-frontend/src/ui-components/CopyButton";
import { useNestedNavigation } from "hkp-frontend/src/runtime/ui/NestedNavigation";
import {
  AssetDescriptor,
  AssetSourceKind,
  AssetUse,
  assetReaches,
  assetSize,
  assetSourceKind,
  formatAssetRef,
  isAssetId,
  isTextMediaType,
  uniqueAssetId,
} from "hkp-frontend/src/runtime/board/assets";
import { AssetPushFailure } from "hkp-frontend/src/core/assetActions";
import { formatBytes } from "hkp-frontend/src/runtime/ui/AssetPanel";
import { useAssetView } from "./AssetViewContext";

/** Past this, inline content is suggested to move to a URL — the author's call, never made for them. */
const LARGE_INLINE_BYTES = 256 * 1024;

/** How long a service stays marked after *Used by* jumped to it. */
const REVEAL_HIGHLIGHT_MS = 2000;
const REVEAL_TIMEOUT_MS = 2000;

/** The editor's language for a media type. */
function languageFor(mediaType: string): string {
  const type = mediaType.split(";")[0].trim().toLowerCase();
  if (type === "text/html") {
    return "html";
  }
  if (type === "text/css") {
    return "css";
  }
  if (type.includes("javascript") || type === "text/ecmascript") {
    return "javascript";
  }
  if (type === "application/json" || type.endsWith("+json")) {
    return "json";
  }
  if (type.endsWith("xml") || type === "image/svg+xml") {
    return "xml";
  }
  if (type === "text/markdown") {
    return "markdown";
  }
  return "plaintext";
}

/** A media type guessed from a file name, for a dropped file whose type the browser did not know. */
function mediaTypeFor(file: File): string {
  if (file.type) {
    return isTextMediaType(file.type) && !file.type.includes("charset")
      ? `${file.type}; charset=utf-8`
      : file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const known: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json",
    svg: "image/svg+xml",
    md: "text/markdown; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return known[extension] ?? "application/octet-stream";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** An asset being edited: the descriptor as it will be applied, and which one it replaces. */
type Draft = {
  descriptor: AssetDescriptor;
  /** The id it was loaded under, or null for one not yet on the board. */
  original: string | null;
};

function draftOf(asset: AssetDescriptor, original: string | null): Draft {
  return { descriptor: asset, original };
}

/**
 * Brings a service's panel into view on the board. Only the top-level service
 * is revealed: a reference nested in a pipeline is shown on the service that
 * holds that pipeline.
 */
function revealServiceFrame(uuid: string) {
  const deadline = performance.now() + REVEAL_TIMEOUT_MS;
  const look = () => {
    const element = document.getElementById(`service-frame-${uuid}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("hkp-service-card--revealed");
      setTimeout(
        () => element.classList.remove("hkp-service-card--revealed"),
        REVEAL_HIGHLIGHT_MS,
      );
      return;
    }
    if (performance.now() < deadline) {
      requestAnimationFrame(look);
    }
  };
  requestAnimationFrame(look);
}

const muted: React.CSSProperties = { opacity: 0.65, fontSize: 12 };
const warning: React.CSSProperties = { fontSize: 12, color: "#b45309" };
const label: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  opacity: 0.65,
};
const field: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid var(--hkp-border, #d4d4d8)",
  borderRadius: 4,
  // The surface a service's card has, a step lighter than the view around it:
  // on the view's own background a field reads as one that cannot be typed in.
  background: "var(--bg-card, #ffffff)",
  color: "var(--text, #1a1a1a)",
  fontSize: 13,
};
const iconButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  border: "1px solid var(--hkp-border, #d4d4d8)",
  borderRadius: 5,
  background: "none",
  cursor: "pointer",
  fontSize: 12,
};

export default function AssetView() {
  const board = useBoardContext();
  const assetView = useAssetView();
  const navigation = useNestedNavigation();
  const assets = useMemo(() => board?.assets ?? [], [board?.assets]);
  const selectedId = assetView?.selected ?? null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uses, setUses] = useState<AssetUse[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A draft belongs to the board it was started on. Kept across a replacement
  // it would be shown over the next board's assets, and applied into them.
  const boardGeneration = board?.boardGeneration;
  const [draftGeneration, setDraftGeneration] = useState(boardGeneration);
  if (draftGeneration !== boardGeneration) {
    setDraftGeneration(boardGeneration);
    setDraft(null);
    setUses(null);
  }

  // What is on screen now, for work that was started on an earlier render and
  // finishes after one of the board's runtimes has answered.
  const latest = useRef({ boardGeneration, assets });
  latest.current = { boardGeneration, assets };
  /** Whether the board open now is still the one this render shows. */
  const onThisBoard = () => latest.current.boardGeneration === boardGeneration;

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;

  // Opening an asset starts a draft of it. A draft of a new asset, not yet on
  // the board, is kept until it is applied or discarded, and a draft already
  // of the asset being opened is kept too: that is the one just applied, which
  // the board's list may not show until its next render.
  useEffect(() => {
    setDraft((current) => {
      if (selectedId === null) {
        return current && current.original === null ? current : null;
      }
      if (current?.original === selectedId) {
        return current;
      }
      return selected ? draftOf(selected, selected.id) : null;
    });
    // Only when a different asset is opened, not whenever the list re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const refreshUses = useCallback(async () => {
    if (!board || !draft?.original) {
      setUses(null);
      return;
    }
    setUses(await board.assetUses(draft.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.assetUses, draft?.original]);

  useEffect(() => {
    void refreshUses();
  }, [refreshUses]);

  if (!board || !assetView) {
    return null;
  }

  const applied = draft
    ? assets.find((asset) => asset.id === draft.original)
    : undefined;
  const dirty =
    !!draft &&
    (!applied || JSON.stringify(draft.descriptor) !== JSON.stringify(applied));
  // The runtimes the last Apply of this asset did not reach.
  const staleOn = (draft?.original && assetView.staleOn[draft.original]) || [];

  const update = (change: Partial<AssetDescriptor>) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            descriptor: {
              ...previous.descriptor,
              ...change,
            } as AssetDescriptor,
          }
        : previous,
    );

  const startNew = (descriptor: AssetDescriptor) => {
    assetView.select(null);
    setDraft(draftOf(descriptor, null));
    setUses(null);
  };

  const newText = () =>
    startNew({
      id: uniqueAssetId(assets, "page"),
      mediaType: "text/html; charset=utf-8",
      text: "<!doctype html>\n<html>\n<body>\n</body>\n</html>\n",
    });

  const newUrl = () =>
    startNew({
      id: uniqueAssetId(assets, "remote"),
      mediaType: "application/octet-stream",
      url: "https://",
    });

  const newFromFile = async (file: File) => {
    const mediaType = mediaTypeFor(file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base = file.name.replace(/\.[^.]+$/, "") || "file";
    const id = uniqueAssetId(assets, base);
    // Text stays text, so it can be edited here; anything else is kept as it
    // came, base64 in the board. Moving large content out is suggested, not done.
    startNew(
      isTextMediaType(mediaType)
        ? {
            id,
            name: file.name,
            mediaType,
            text: new TextDecoder().decode(bytes),
          }
        : {
            id,
            name: file.name,
            mediaType,
            base64: toBase64(bytes),
            size: bytes.length,
          },
    );
  };

  const setSourceKind = (kind: AssetSourceKind) => {
    if (!draft) {
      return;
    }
    const { id, name, mediaType, runtimes } = draft.descriptor;
    const base = {
      id,
      ...(name ? { name } : {}),
      mediaType,
      ...(runtimes ? { runtimes } : {}),
    };
    const next: AssetDescriptor =
      kind === "text"
        ? { ...base, text: "" }
        : kind === "base64"
          ? { ...base, base64: "" }
          : { ...base, url: "https://" };
    setDraft({ ...draft, descriptor: next });
  };

  // The runtimes an asset can be kept to are the board's own: one a unit
  // contributed is given that unit's assets.
  const ownRuntimes = board.runtimes.filter((runtime) => !runtime.unit);

  // Two answers to "which runtimes are given this asset", kept apart: every
  // one, which says nothing and so covers a runtime added later, or the ones
  // named. Ticking every runtime there is does not turn the second into the
  // first — a list stays a list, and a later runtime is not on it.
  const setRuntimes = (runtimes: string[] | undefined) => {
    if (!draft) {
      return;
    }
    const { runtimes: _previous, ...rest } = draft.descriptor;
    setDraft({
      ...draft,
      descriptor: (runtimes ? { ...rest, runtimes } : rest) as AssetDescriptor,
    });
  };

  const setReaches = (runtimeId: string, reaches: boolean) => {
    if (!draft) {
      return;
    }
    setRuntimes(
      ownRuntimes
        .filter((runtime) =>
          runtime.id === runtimeId
            ? reaches
            : assetReaches(draft.descriptor, runtime),
        )
        .map((runtime) => runtime.id),
    );
  };

  const problemWith = (candidate: Draft): string | null => {
    const { descriptor } = candidate;
    if (!isAssetId(descriptor.id)) {
      return "An id is letters, digits, “.”, “-” and “_”.";
    }
    if (
      descriptor.id !== candidate.original &&
      assets.some((asset) => asset.id === descriptor.id)
    ) {
      return `An asset "${descriptor.id}" already exists.`;
    }
    if (!descriptor.mediaType.trim()) {
      return "A media type is required.";
    }
    if ("url" in descriptor) {
      try {
        new URL(descriptor.url);
      } catch {
        return "The URL is not one.";
      }
    }
    return null;
  };

  const apply = async () => {
    if (!draft) {
      return;
    }
    const descriptor = draft.descriptor;
    const problem = problemWith(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const failures = await board.setAsset(
        descriptor,
        draft.original ?? undefined,
      );
      // Another board was opened meanwhile: what came of this is not its to show.
      if (!onThisBoard()) {
        return;
      }
      const renamed = !!draft.original && draft.original !== descriptor.id;
      setDraft(draftOf(descriptor, descriptor.id));
      assetView.select(descriptor.id);
      if (renamed) {
        assetView.setStaleOn(draft.original!, []);
      }
      // Whatever it was to be sent — the asset, or its removal from a runtime
      // it is no longer for — it still has what it had.
      const stale = failures.filter(({ push }) => descriptor.id in push);
      const names = stale.map(({ runtime }) => runtime.name);
      assetView.setStaleOn(descriptor.id, names);
      if (stale.length) {
        // The board has the change and the runtime does not: it goes on using
        // the version before, and nothing else would say so.
        toast.warning(`"${descriptor.id}" did not reach ${names.join(", ")}`, {
          description: `${stale.map(({ problem }) => problem).join("\n")}\nThe version before is still in use there. Apply sends it again.`,
        });
      } else {
        toast.success(
          renamed
            ? `Renamed "${draft.original}" to "${descriptor.id}"`
            : `Applied "${descriptor.id}"`,
        );
      }
      if (renamed) {
        reportLeftOn(
          draft.original!,
          failures.filter(({ push }) => push[draft.original!] === null),
        );
      }
    } catch (err: any) {
      if (onThisBoard()) {
        toast.error(`Could not apply "${descriptor.id}"`, {
          description: err?.message ?? String(err),
        });
      }
    } finally {
      setBusy(false);
      if (onThisBoard()) {
        void refreshUses();
      }
    }
  };

  // An asset the board dropped and a runtime still holds has no row to be
  // marked on, so the notice itself carries the way to ask again — for as long
  // as that is still the same question: the same board, and no asset started
  // under the id since.
  const reportLeftOn = (id: string, failures: AssetPushFailure[]) => {
    if (!failures.length) {
      return;
    }
    const names = failures.map(({ runtime }) => runtime.name).join(", ");
    toast.warning(`"${id}" is still on ${names}`, {
      description: `${failures.map(({ problem }) => problem).join("\n")}\nIt is out of the board, but an asset service asked for it by name there still emits it.`,
      action: {
        label: "Retry",
        onClick: () => {
          if (
            onThisBoard() &&
            !latest.current.assets.some((asset) => asset.id === id)
          ) {
            void removeFromRuntimes(id);
          }
        },
      },
    });
  };

  const removeFromRuntimes = async (id: string) => {
    try {
      const failures = await board.deleteAsset(id);
      if (!onThisBoard()) {
        return;
      }
      if (failures.length) {
        reportLeftOn(id, failures);
      } else {
        toast.success(`Removed "${id}" from the runtimes`);
      }
    } catch (err: any) {
      if (onThisBoard()) {
        toast.error(`Could not remove "${id}"`, {
          description: err?.message ?? String(err),
        });
      }
    }
  };

  const revert = () => {
    if (!draft) {
      return;
    }
    const original = assets.find((asset) => asset.id === draft.original);
    setDraft(original ? draftOf(original, original.id) : null);
  };

  const remove = async () => {
    if (!draft?.original) {
      setDraft(null);
      return;
    }
    const id = draft.original;
    const current = await board.assetUses(id);
    if (!onThisBoard()) {
      return;
    }
    if (
      current.length &&
      !window.confirm(
        `"${id}" is still referenced by ${current.length} ${current.length === 1 ? "service" : "services"}. Delete it anyway?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const failures = await board.deleteAsset(id);
      if (!onThisBoard()) {
        return;
      }
      assetView.setStaleOn(id, []);
      assetView.select(null);
      setDraft(null);
      reportLeftOn(id, failures);
    } catch (err: any) {
      if (onThisBoard()) {
        toast.error(`Could not delete "${id}"`, {
          description: err?.message ?? String(err),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const openUse = (use: AssetUse) => {
    assetView.hide();
    navigation?.goTo(0);
    revealServiceFrame(use.serviceUuid);
  };

  const runtimeName = (runtimeId: string) =>
    board.runtimes.find((runtime) => runtime.id === runtimeId)?.name ??
    runtimeId;

  const kind = draft ? assetSourceKind(draft.descriptor) : null;
  const size = draft ? assetSize(draft.descriptor) : undefined;

  return (
    <div
      style={{
        // Over the runtimes, which stay mounted and laid out underneath — only
        // hidden — so in the flow this would sit below them and be clipped.
        // Fills whatever holds it, the way the overview does.
        position: "absolute",
        inset: 0,
        display: "flex",
        background: "var(--bg-app, #fafafa)",
        color: "var(--text, #1a1a1a)",
        textAlign: "left",
        fontSize: 13,
        borderTop: "1px solid var(--hkp-border, #e4e4e7)",
      }}
    >
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: "1px solid var(--hkp-border, #e4e4e7)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", gap: 6, padding: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={iconButton}
            onClick={newText}
            title="New inline text asset"
          >
            <FilePlus2 size={13} /> Text
          </button>
          <button
            type="button"
            style={iconButton}
            onClick={() => fileInputRef.current?.click()}
            title="New asset from a file"
          >
            <Upload size={13} /> File
          </button>
          <button
            type="button"
            style={iconButton}
            onClick={newUrl}
            title="New asset at a URL"
          >
            <Link2 size={13} /> URL
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void newFromFile(file);
              }
            }}
          />
        </div>
        <div
          style={{ overflowY: "auto", flex: 1 }}
          role="listbox"
          aria-label="Assets"
        >
          {!assets.length && !draft && (
            <p style={{ ...muted, padding: "4px 12px" }}>
              This board declares no assets yet. Content a service serves, plays
              or loads can live here once and be named from its state as{" "}
              <code>hkp-asset://id</code>.
            </p>
          )}
          {assets.map((asset) => {
            const active = draft?.original === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => assetView.select(asset.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 12px",
                  border: "none",
                  cursor: "pointer",
                  background: active
                    ? "var(--hkp-accent-dim, rgba(10,188,251,0.12))"
                    : "none",
                }}
              >
                <div style={{ fontWeight: 500 }}>{asset.name || asset.id}</div>
                <div style={muted}>
                  {asset.id} · {asset.mediaType.split(";")[0]} ·{" "}
                  {assetSourceKind(asset)} · {formatBytes(assetSize(asset))}
                </div>
                {assetView.staleOn[asset.id] && (
                  <div style={warning}>
                    not on {assetView.staleOn[asset.id].join(", ")}
                  </div>
                )}
              </button>
            );
          })}
          {draft && draft.original === null && (
            <div
              style={{
                padding: "6px 12px",
                background: "var(--hkp-accent-dim, rgba(10,188,251,0.12))",
              }}
            >
              <div style={{ fontWeight: 500 }}>{draft.descriptor.id}</div>
              <div style={muted}>new — not applied yet</div>
            </div>
          )}
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: 12,
          gap: 10,
          overflowY: "auto",
        }}
      >
        {!draft ? (
          <p style={muted}>Choose an asset, or start a new one.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <label>
                <div style={label}>Id</div>
                <input
                  style={field}
                  value={draft.descriptor.id}
                  onChange={(event) =>
                    update({ id: event.target.value.trim() })
                  }
                  aria-label="Asset id"
                  spellCheck={false}
                />
              </label>
              <label>
                <div style={label}>Name</div>
                <input
                  style={field}
                  value={draft.descriptor.name ?? ""}
                  placeholder={draft.descriptor.id}
                  onChange={(event) =>
                    update({ name: event.target.value || undefined })
                  }
                  aria-label="Asset name"
                  spellCheck={false}
                />
              </label>
              <label>
                <div style={label}>Media type</div>
                <input
                  style={field}
                  value={draft.descriptor.mediaType}
                  onChange={(event) =>
                    update({ mediaType: event.target.value })
                  }
                  aria-label="Media type"
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={label}>Source</span>
              {(["text", "base64", "url"] as const).map((option) => (
                <label
                  key={option}
                  style={{
                    display: "inline-flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="radio"
                    name="asset-source"
                    checked={kind === option}
                    onChange={() => setSourceKind(option)}
                  />
                  {option === "text"
                    ? "Inline text"
                    : option === "base64"
                      ? "Inline bytes"
                      : "URL"}
                </label>
              ))}
              <span style={muted}>{formatBytes(size)}</span>
              {/* What a service's state holds to name this asset, there to be taken. */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  marginLeft: "auto",
                }}
              >
                <code style={muted}>{formatAssetRef(draft.descriptor.id)}</code>
                <CopyButton
                  value={formatAssetRef(draft.descriptor.id)}
                  label="reference"
                />
              </span>
            </div>

            {kind !== "url" &&
              size !== undefined &&
              size > LARGE_INLINE_BYTES && (
                <p style={warning}>
                  This is large to keep inside the board, which every save and
                  share carries. Consider hosting it and naming it here by URL.
                </p>
              )}

            {"text" in draft.descriptor && (
              <Editor
                key={`${draft.original ?? "new"}:${languageFor(draft.descriptor.mediaType)}`}
                value={draft.descriptor.text}
                language={languageFor(draft.descriptor.mediaType)}
                height={420}
                onChange={(text) =>
                  update({ text: text ?? "" } as Partial<AssetDescriptor>)
                }
              />
            )}

            {"base64" in draft.descriptor && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={muted}>
                  {draft.descriptor.base64
                    ? `${formatBytes(size)} of ${draft.descriptor.mediaType.split(";")[0]}, kept in the board`
                    : "No content yet."}
                </span>
                <label style={iconButton}>
                  <Upload size={13} /> Replace from file
                  <input
                    type="file"
                    hidden
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) {
                        return;
                      }
                      const bytes = new Uint8Array(await file.arrayBuffer());
                      update({
                        base64: toBase64(bytes),
                        size: bytes.length,
                      } as Partial<AssetDescriptor>);
                    }}
                  />
                </label>
              </div>
            )}

            {"url" in draft.descriptor && (
              <div style={{ display: "grid", gap: 8 }}>
                <label>
                  <div style={label}>URL</div>
                  <input
                    style={field}
                    value={draft.descriptor.url}
                    onChange={(event) =>
                      update({
                        url: event.target.value,
                      } as Partial<AssetDescriptor>)
                    }
                    aria-label="Asset URL"
                  />
                </label>
                <label>
                  <div style={label}>sha256 (optional — pins the version)</div>
                  <input
                    style={field}
                    value={draft.descriptor.sha256 ?? ""}
                    onChange={(event) =>
                      update({ sha256: event.target.value.trim() || undefined })
                    }
                    aria-label="sha256"
                  />
                </label>
                <p style={muted}>
                  Fetched as it is, by each runtime using it: an asset sends no
                  headers and no credentials. Content that needs them is fetched
                  by a service.
                </p>
              </div>
            )}

            {ownRuntimes.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
                role="group"
                aria-label="Runtimes given this asset"
              >
                <span style={label}>Given to</span>
                <label
                  style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                >
                  <input
                    type="radio"
                    name="asset-runtimes"
                    checked={!draft.descriptor.runtimes}
                    onChange={() => setRuntimes(undefined)}
                  />
                  Every runtime, including any added later
                </label>
                <label
                  style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                >
                  <input
                    type="radio"
                    name="asset-runtimes"
                    checked={!!draft.descriptor.runtimes}
                    // Starts from the ones that have it now, so that choosing
                    // this changes nothing until one is unticked.
                    onChange={() =>
                      setRuntimes(ownRuntimes.map((runtime) => runtime.id))
                    }
                  />
                  Only these:
                </label>
                {ownRuntimes.map((runtime) => (
                  <label
                    key={runtime.id}
                    style={{
                      display: "inline-flex",
                      gap: 4,
                      alignItems: "center",
                      opacity: draft.descriptor.runtimes ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!draft.descriptor.runtimes}
                      checked={
                        !!draft.descriptor.runtimes &&
                        assetReaches(draft.descriptor, runtime)
                      }
                      onChange={(event) =>
                        setReaches(runtime.id, event.target.checked)
                      }
                    />
                    {runtime.name || runtime.id}
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="hkp-svc-btn"
                style={{ ...iconButton, fontWeight: 600 }}
                disabled={(!dirty && !staleOn.length) || busy}
                onClick={() => void apply()}
                title="Push this asset to the runtimes that use it; they serve it on their next use"
              >
                Apply
              </button>
              <button
                type="button"
                style={iconButton}
                disabled={!dirty || busy}
                onClick={revert}
              >
                {draft.original ? "Revert" : "Discard"}
              </button>
              <span style={{ flex: 1 }} />
              {draft.original && (
                <button
                  type="button"
                  style={{ ...iconButton, color: "#dc2626" }}
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>

            {staleOn.length > 0 && (
              <p style={warning}>
                Not on {staleOn.join(", ")}: the last change did not arrive
                there, so the version before it is still in use. Apply sends it
                again.
              </p>
            )}

            {draft.original && (
              <section>
                <div style={{ ...label, marginBottom: 4 }}>Used by</div>
                {uses === null ? (
                  <span style={muted}>Looking…</span>
                ) : uses.length === 0 ? (
                  <span style={muted}>No service names this asset yet.</span>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    {uses.map((use, index) => (
                      <li
                        key={`${use.runtimeId}/${use.serviceUuid}/${use.path.join(".")}/${index}`}
                      >
                        <button
                          type="button"
                          onClick={() => openUse(use)}
                          style={{
                            ...iconButton,
                            border: "none",
                            padding: "2px 0",
                          }}
                          title="Open this service"
                        >
                          <CornerUpRight size={12} />
                          <strong>{use.serviceName || use.serviceUuid}</strong>
                          <span style={muted}>
                            {runtimeName(use.runtimeId)} ·{" "}
                            {use.path.join(".") || "(state)"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
