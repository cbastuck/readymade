import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import LoadBoardDialog from "./LoadBoardDialog";
import DemoBoardDialog from "./DemoBoardDialog";
import { useJsApi } from "./hooks";
import { BoardDescriptor } from "hkp-frontend/src/types";

type Props = {
  boardSource?: string;
  loadBoardItems?: Array<string> | null;
  demoBoardDialogOpen?: boolean;
  onCloseDemoBoardDialog?: () => void;
  onCloseBoardSource?: () => void;
  onChangeLoadDialogVisibility?: (visible: boolean) => void;
  onDeleteBoard?: (saveName: string) => Promise<void>;
  onBoardLoaded?: (board: BoardDescriptor) => void;
};

export default function Board({
  boardSource,
  loadBoardItems,
  demoBoardDialogOpen = false,
  onCloseDemoBoardDialog = () => {},
  onCloseBoardSource = () => {},
  onChangeLoadDialogVisibility = () => {},
  onDeleteBoard = async () => {},
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
        visible={!!loadBoardItems}
        items={loadBoardItems || []}
        onSetVisible={onChangeLoadDialogVisibility}
        onDeleteBoard={onDeleteBoard}
        onBoardLoaded={onBoardLoaded}
      />
    </>
  );
}
