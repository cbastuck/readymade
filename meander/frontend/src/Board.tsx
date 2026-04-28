import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import LoadBoardDialog from "./LoadBoardDialog";
import DemoBoardDialog from "./DemoBoardDialog";
import { useJsApi } from "./hooks";
import { BoardDescriptor } from "hkp-frontend/src/types";

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
      />
      <LoadBoardDialog
        visible={isLoadDialogOpen}
        onSetVisible={onSetLoadDialogOpen}
        onBoardLoaded={onBoardLoaded}
      />
    </>
  );
}
