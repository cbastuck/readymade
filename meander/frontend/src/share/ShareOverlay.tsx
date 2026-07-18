import ShareBoardPicker from "./ShareBoardPicker";
import { ShareFlow } from "./useShareFlow";

/**
 * The board picker for a share awaiting a choice. Render on every route/view
 * so a share arriving anywhere still asks; nothing while the flow is idle.
 */
export default function ShareOverlay({ flow }: { flow: ShareFlow }) {
  if (!flow.pendingShare) {
    return null;
  }
  return (
    <ShareBoardPicker
      share={flow.pendingShare}
      boards={flow.boards}
      onPick={flow.onPickBoard}
      onCancel={flow.onCancelShare}
    />
  );
}
