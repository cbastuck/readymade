import { BoardDescriptor, PlaygroundTemplate } from "@/types";

import { runtimeApis } from "../../views/playground";
import BoardProvider, { BoardContextState } from "@/BoardContext";
import { availableRuntimeEngines } from "../../views/playground/common";
import BoardFrame from "./BoardFrame";
import WrappedBoard from "./WrappedBoard";

type Props = {
  board: PlaygroundTemplate;
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
      removeRuntime={async () => {}}
      newBoard={() => {}}
      clearBoard={async () => {}}
      saveBoard={() => {}}
      isActionAvailable={() => false}
      serializeBoard={async () => null}
      onAction={() => false}
      onRemoveService={() => {}}
    >
      <BoardFrame>
        <WrappedBoard {...props} />
      </BoardFrame>
    </BoardProvider>
  );
}
