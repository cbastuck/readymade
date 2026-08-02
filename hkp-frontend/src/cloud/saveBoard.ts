import { BoardContextState } from "../BoardContext";
import { BoardMenuItem } from "../types";
import { upsertCloudBoard } from "./boardStorage";

/**
 * Saving the current board to the user's cloud storage.
 *
 * This is storage, not deployment: the board is filed under the user's account
 * and nothing starts running. It is also the moment a shared board publishes —
 * viewers see "update available" exactly when the owner saves, because the
 * upsert bumps the record's updated_at.
 */

export async function saveBoardToCloud(
  boardContext: BoardContextState,
  user: { idToken: string },
): Promise<{ id: string; name: string }> {
  const data = await boardContext.serializeBoard();
  if (!data) {
    throw new Error("Could not serialize the current board");
  }
  const name = boardContext.boardName || data.boardName || "Untitled board";
  const { id } = await upsertCloudBoard(
    { idToken: user.idToken },
    {
      name,
      data: data as unknown as Record<string, unknown>,
      metadata: data.description ? { description: data.description } : undefined,
    },
  );
  return { id, name };
}

/**
 * The board menu's cloud-save entry.
 *
 * Shared rather than written into each menu: hosts assemble their own board
 * menus, and saving to the account's storage is not a per-host capability —
 * leaving it out of one would silently drop it there.
 */
export function saveBoardInCloudMenuItem(
  boardContext: BoardContextState,
): BoardMenuItem {
  const user = boardContext.appContext?.user;
  return {
    title: "Save Board in Cloud",
    description: user
      ? "Save the current board to your cloud boards"
      : "Log in to save this board to the cloud",
    disabled: !user,
    onClick: () => {
      if (!user) {
        return;
      }
      saveBoardToCloud(boardContext, user)
        .then(({ name }) =>
          boardContext.appContext?.pushNotification({
            type: "success",
            message: `Cloud version of “${name}” updated`,
          }),
        )
        .catch((err: unknown) =>
          boardContext.appContext?.pushNotification({
            type: "error",
            message:
              err instanceof Error && err.message
                ? `Cloud save failed — ${err.message}`
                : "Cloud save failed",
          }),
        );
    },
  };
}
