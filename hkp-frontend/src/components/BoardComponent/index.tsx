import { useRef, useState } from "react";
import { Settings, CircleX } from "lucide-react";

import { BoardDescriptor, PlaygroundState } from "@/types";
import { runtimeApis } from "../../views/playground";
import BoardProvider, { BoardContextState } from "@/BoardContext";
import { availableRuntimeEngines } from "../../views/playground/common";
import BoardFrame from "./BoardFrame";

export type BoardAPI = {
  runBoard: () => void;
};

type Props = {
  board: PlaygroundState;
  params?: any;
  title?: string;
  children?: (result: any) => React.ReactElement;
};

export default function BoardComponent(props: Props) {
  const { board, params, title, children } = props;

  const runBoard = (cs: BoardContextState) =>
    cs.onAction({ type: "playBoard", params });
  const onFetchBoard = async (): Promise<BoardDescriptor> => board;
  const onLoad = runBoard;

  const [result, setResult] = useState<any>(null);
  const [hideBoard, setHideBoard] = useState<boolean>(true);
  const onToggleBoardVisibility = () => setHideBoard((prev) => !prev);
  const onResult = setResult;

  const boardContextRef = useRef<BoardProvider | null>(null);
  const boardApi = {
    runBoard: () => {
      boardContextRef.current && runBoard(boardContextRef.current?.state);
    },
  };
  return (
    <BoardProvider
      ref={(ref) => (boardContextRef.current = ref)}
      user={null}
      boardName={board.boardName}
      fetchBoard={onFetchBoard}
      onLoad={onLoad}
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
      <BoardFrame
        boardApi={boardApi}
        title={title}
        placeholder={children}
        toggleIcon={hideBoard ? Settings : CircleX}
        board={board}
        hideBoard={hideBoard}
        result={result}
        onResult={onResult}
        onToggleVisibility={onToggleBoardVisibility}
      />
    </BoardProvider>
  );
}
