import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import LoadBoardDialog from "./LoadBoardDialog";
import { SavedBoardDescriptor } from "./types";
import { useJsApi } from "./hooks";

type Props = {
  boardSource?: string;
  loadBoardItems?: Array<SavedBoardDescriptor> | null;
  onCloseBoardSource?: () => void;
  onChangeLoadDialogVisibility?: (visible: boolean) => void;
  onDeleteBoard?: (saveName: string) => Promise<void>;
};

export default function Board({
  boardSource,
  loadBoardItems,
  onCloseBoardSource = () => {},
  onChangeLoadDialogVisibility = () => {},
  onDeleteBoard = async () => {},
}: Props) {
  useJsApi();
  return (
    <>
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
      />
    </>
  );
}
