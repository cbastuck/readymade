import { useContext, useState } from "react";
import { CloudUpload } from "lucide-react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { upsertCloudBoard } from "hkp-frontend/src/cloud/boardStorage";

/**
 * Toolbar action that pushes the current board to the user's cloud storage.
 * This is the only deliberate "publish" moment for shared boards: viewers see
 * an "Update available" badge exactly when the owner presses this (the
 * upsert bumps the record's updated_at).
 */
export default function UpdateCloudButton() {
  const boardContext = useContext(BoardCtx);
  const user = boardContext?.appContext?.user;
  const [busy, setBusy] = useState(false);

  const update = async () => {
    if (!boardContext || !user || busy) {
      return;
    }
    setBusy(true);
    try {
      const data = await boardContext.serializeBoard();
      if (!data) {
        throw new Error("Could not serialize the current board");
      }
      const name = boardContext.boardName || data.boardName || "Untitled board";
      await upsertCloudBoard(
        { idToken: user.idToken },
        {
          name,
          data: data as unknown as Record<string, unknown>,
          metadata: data.description
            ? { description: data.description }
            : undefined,
        },
      );
      boardContext.appContext?.pushNotification({
        type: "success",
        message: `Cloud version of “${name}” updated`,
      });
    } catch (err) {
      boardContext.appContext?.pushNotification({
        type: "error",
        message:
          err instanceof Error && err.message
            ? `Cloud update failed — ${err.message}`
            : "Cloud update failed",
      });
    } finally {
      setBusy(false);
    }
  };

  const disabled = !user || busy;

  return (
    <button
      type="button"
      title={user ? "Upload to cloud" : "Log in to upload to cloud"}
      disabled={disabled}
      onClick={() => void update()}
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        border: "none",
        background: "none",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text, #1a1a1a)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <CloudUpload size={16} strokeWidth={1.75} />
    </button>
  );
}
