import { useContext } from "react";
import { BoardDescriptor, PlaygroundState } from "@/types";
import Board from "../playground/Board";
import { runtimeApis } from "../playground";
import BoardProvider, { BoardContextState, BoardCtx } from "@/BoardContext";
import { availableRuntimeEngines } from "../playground/common";

type Props = {
  board: PlaygroundState;
  params?: any;
  hidden?: boolean;
  onResult: (result: any) => void;
};

export default function BoardComponent(props: Props) {
  const { board, params } = props;

  const onFetchBoard = async (): Promise<BoardDescriptor> => board;
  const onLoad = (boardContext: BoardContextState) =>
    boardContext.onAction({ type: "playBoard", params });

  return (
    <BoardProvider
      user={null}
      boardName={board.boardName}
      fetchBoard={onFetchBoard}
      onLoad={onLoad}
      fetchAfterMount={true}
      runtimeApis={runtimeApis}
      availableRuntimeEngines={availableRuntimeEngines}
      isRuntimeInScope={() => true}
      onRemoveRuntime={async () => {}}
      newBoard={() => {}}
      clearBoard={async () => {}}
      saveBoard={() => {}}
      isActionAvailable={() => false}
      serializeBoard={async () => null}
      onAction={() => false}
      onRemoveService={() => {}}
    >
      <WrappedBoard {...props} />
    </BoardProvider>
  );
}

function WrappedBoard({
  board,
  hidden,
  onResult,
}: Pick<Props, "board" | "onResult" | "hidden">) {
  const boardContext = useContext(BoardCtx);
  return boardContext ? (
    <div style={{ display: hidden ? "none" : undefined }}>
      <Board
        boardName="localStorageBoard"
        boardContext={boardContext}
        inputRouting={{}}
        outputRouting={{}}
        sidechainRouting={{}}
        description={board.description}
        onResult={onResult}
        onChangeOutputRouting={() => {}}
        onChangeInputRouting={() => {}}
        onChangeSidechainRouting={() => {}}
      />
    </div>
  ) : null;
}
