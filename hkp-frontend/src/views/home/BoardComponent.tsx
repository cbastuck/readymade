import { BoardDescriptor, PlaygroundTemplate } from "@/types";
import Board from "../playground/Board";
import { runtimeApis } from "../playground";
import BoardProvider, { BoardConsumer } from "@/BoardContext";
import { availableRuntimeEngines } from "../playground/common";

type Props = {
  board: PlaygroundTemplate;
};

export default function BoardComponent({ board }: Props) {
  const onFetchBoard = async (): Promise<BoardDescriptor> => board;

  const onResult = (res: any) => console.log("locaStorageREsult", res);

  return (
    <BoardProvider
      user={null}
      boardName={board.boardName}
      fetchBoard={onFetchBoard}
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
      <BoardConsumer>
        {(boardContext) =>
          boardContext && (
            <Board
              boardName="localStorageBoard"
              boardContext={boardContext}
              inputRouting={{}}
              outputRouting={{}}
              sidechainRouting={{}}
              description={board.description}
              headless={true}
              onResult={onResult}
              onChangeOutputRouting={() => {}}
              onChangeInputRouting={() => {}}
              onChangeSidechainRouting={() => {}}
            />
          )
        }
      </BoardConsumer>
    </BoardProvider>
  );
}
