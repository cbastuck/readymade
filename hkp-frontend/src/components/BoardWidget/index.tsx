import { useEffect, useRef, useState } from "react";
import { Settings, CircleX } from "lucide-react";

import { BoardDescriptor, User } from "hkp-frontend/src/types";

import BoardProvider, {
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { availableRuntimeEngines } from "../../views/playground/common";
import BoardWidgetFrame from "./BoardWidgetFrame";
import { runtimeApis } from "hkp-frontend/src/views/playground";

export type BoardWidgetAPI = {
  runBoard: (params?: any) => void;
};

type Props = {
  user?: User | null;
  board: BoardDescriptor;
  params?: any;
  title?: string;
  removable?: boolean;
  boardHiddenOnInit?: boolean;
  runBoardAfterLoad?: boolean;
  apiRef?: any;
  children?: (result: any) => React.ReactElement | null;
  onRemoveWidget?: () => void;
  onConfig?: (config: any) => void;
};

export default function BoardWidget(props: Props) {
  const {
    board,
    params,
    title,
    children,
    user,
    removable,
    apiRef,
    boardHiddenOnInit = true,
    runBoardAfterLoad = true,
    onRemoveWidget,
    onConfig,
  } = props;
  const [result, setResult] = useState<any>(null);
  const [hideBoard, setHideBoard] = useState<boolean>(boardHiddenOnInit);
  const boardContextRef = useRef<BoardProvider | null>(null);

  const runBoard = (cs: BoardContextState, p?: any) =>
    cs.onAction({ type: "playBoard", params: p ?? params });
  const onFetchBoard = async (): Promise<BoardDescriptor> => board;
  const onToggleBoardVisibility = () => setHideBoard((prev) => !prev);
  const boardApi: BoardWidgetAPI = {
    runBoard: (p: any) => {
      if (boardContextRef.current) {
        runBoard(boardContextRef.current?.state, p);
      }
    },
  };
  if (apiRef) {
    apiRef.current = boardApi;
  }

  useEffect(() => {
    boardContextRef.current?.fetchBoard();
  }, [board]);

  return (
    <BoardProvider
      ref={(ref) => (boardContextRef.current = ref)}
      user={user || null}
      boardName={board.boardName}
      fetchBoard={onFetchBoard}
      onLoad={runBoardAfterLoad ? runBoard : undefined}
      fetchAfterMount={true}
      runtimeApis={runtimeApis}
      availableRuntimeEngines={availableRuntimeEngines}
      isRuntimeInScope={() => true}
      onRemoveRuntime={async () => {}}
      newBoard={() => {}}
      onClearBoard={async () => {}}
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
        removable={removable}
        params={params}
        onResult={setResult}
        onToggleVisibility={onToggleBoardVisibility}
        onRemoveWidget={onRemoveWidget}
        onConfig={onConfig}
      />
    </BoardProvider>
  );
}
