import { useContext } from "react";
import Board from "../../views/playground/Board";
import { BoardCtx } from "@/BoardContext";
import { PlaygroundState } from "@/types";

type Props = {
  board: PlaygroundState;
  hidden?: boolean;
  onResult: (result: any) => void;
};

export default function WrappedBoard({ board, hidden, onResult }: Props) {
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
