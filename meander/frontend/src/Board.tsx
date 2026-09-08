import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import LoadBoardDialog from "./LoadBoardDialog";
import DemoBoardDialog from "./DemoBoardDialog";
import { useJsApi } from "./hooks";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import { assureJSON } from "hkp-frontend/src/common";
import { BoardDescriptor } from "hkp-frontend/src/types";
import { saveBoard } from "./actions";

type Props = {
  boardSource?: string;
  isLoadDialogOpen?: boolean;
  demoBoardDialogOpen?: boolean;
  onCloseDemoBoardDialog?: () => void;
  onCloseBoardSource?: () => void;
  onSetLoadDialogOpen?: (open: boolean) => void;
  onBoardLoaded?: (board: BoardDescriptor) => void;
};

export default function Board({
  boardSource,
  isLoadDialogOpen = false,
  demoBoardDialogOpen = false,
  onCloseDemoBoardDialog = () => {},
  onCloseBoardSource = () => {},
  onSetLoadDialogOpen = () => {},
  onBoardLoaded = () => {},
}: Props) {
  useJsApi();
  const boardContext = useBoardContext();

  const onApplyBoardSource = async (newSource: string | object) => {
    const src = assureJSON(newSource) as BoardDescriptor;
    await boardContext?.setBoardState(src);
    onCloseBoardSource();
  };

  const onSaveBoardSource = async (newSource: string | object) => {
    const src = assureJSON(newSource) as BoardDescriptor;
    const name = src.boardName || boardContext?.boardName;
    if (!name) {
      boardContext?.appContext?.pushNotification({
        type: "error",
        message: "Board has no name to save under",
      });
      return;
    }
    await boardContext?.setBoardState(src);
    await saveBoard(name, src);
    boardContext?.appContext?.pushNotification({
      type: "info",
      message: `Board "${name}" saved`,
    });
    onCloseBoardSource();
  };

  return (
    <>
      <DemoBoardDialog
        isOpen={demoBoardDialogOpen}
        onClose={onCloseDemoBoardDialog}
      />
      <EditorDialog
        title="Board Configuration"
        isOpen={!!boardSource}
        value={boardSource || ""}
        onClose={onCloseBoardSource}
        actions={[
          { label: "Apply Changes", onAction: onApplyBoardSource },
          { label: "Save Board", onAction: onSaveBoardSource },
        ]}
      />
      <LoadBoardDialog
        visible={isLoadDialogOpen}
        onSetVisible={onSetLoadDialogOpen}
        onBoardLoaded={onBoardLoaded}
      />
    </>
  );
}
