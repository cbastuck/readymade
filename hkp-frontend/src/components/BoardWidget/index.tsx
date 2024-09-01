import { useRef, useState } from "react";
import { Settings, CircleX } from "lucide-react";

import { BoardDescriptor, PlaygroundState, User } from "@/types";
import { runtimeApis } from "../../views/playground";
import BoardProvider, { BoardContextState } from "@/BoardContext";
import { availableRuntimeEngines } from "../../views/playground/common";
import BoardWidgetFrame from "./BoardWidgetFrame";

export type BoardWidgetAPI = {
  runBoard: () => void;
};

type Props = {
  user?: User | null;
  board: PlaygroundState;
  params?: any;
  title?: string;
  children?: (result: any) => React.ReactElement;
  onRemoveWidget?: () => void;
};

export default function BoardWidget(props: Props) {
  const { board, params, title, children, user, onRemoveWidget } = props;
  const [result, setResult] = useState<any>(null);
  const [hideBoard, setHideBoard] = useState<boolean>(true);
  const boardContextRef = useRef<BoardProvider | null>(null);

  const runBoard = (cs: BoardContextState) =>
    cs.onAction({ type: "playBoard", params });
  const onFetchBoard = async (): Promise<BoardDescriptor> => board;
  const onToggleBoardVisibility = () => setHideBoard((prev) => !prev);
  const boardApi = {
    runBoard: () => {
      boardContextRef.current && runBoard(boardContextRef.current?.state);
    },
  };
  return (
    <BoardProvider
      ref={(ref) => (boardContextRef.current = ref)}
      user={user || null}
      boardName={board.boardName}
      fetchBoard={onFetchBoard}
      onLoad={runBoard}
      fetchAfterMount={true}
      runtimeApis={runtimeApis}
      availableRuntimeEngines={availableRuntimeEngines}
      isRuntimeInScope={() => true}
      removeRuntime={async () => {}}
      newBoard={() => {}}
      clearBoard={async () => {}}
      saveBoard={() => {}}
      isActionAvailable={() => false}
      serializeBoard={async () => null}
      onAction={() => false}
      onRemoveService={() => {}}
    >
      <BoardWidgetFrame
        boardApi={boardApi}
        title={title}
        placeholder={children}
        toggleIcon={hideBoard ? Settings : CircleX}
        board={board}
        hideBoard={hideBoard}
        result={result}
        onResult={setResult}
        onToggleVisibility={onToggleBoardVisibility}
        onRemoveWidget={onRemoveWidget}
      />
    </BoardProvider>
  );
}
