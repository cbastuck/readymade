import { RotateCw } from "lucide-react";

import { PlaygroundState } from "@/types";
import WrappedBoard from "./WrappedBoard";
import { BoardAPI } from ".";
import IconButton from "@/ui-components/boardmanager/IconButton";

type Props = {
  title?: string;
  placeholder?: (result: any) => React.ReactElement;
  board: PlaygroundState;
  hideBoard?: boolean;
  result: any;
  toggleIcon?: React.ComponentType;
  boardApi: BoardAPI | null;
  onResult: (result: { result: any; api: BoardAPI }) => void;
  onToggleVisibility: () => void;
};

export default function BoardFrame({
  title,
  placeholder,
  board,
  hideBoard,
  result,
  toggleIcon,
  boardApi,
  onResult,
  onToggleVisibility,
}: Props) {
  const onRunBoard = () => {
    boardApi && boardApi.runBoard();
  };
  return (
    <div
      className={
        hideBoard ? "border border-white" : "solid border border-gray w-full"
      }
    >
      <div className="flex w-full p-1 gap-2">
        <span className="w-full text-2xl">{title}</span>

        <IconButton onClick={onRunBoard} icon={RotateCw} />
        <IconButton onClick={onToggleVisibility} icon={toggleIcon} />
      </div>

      <div className="px-4">
        <WrappedBoard board={board} hidden={hideBoard} onResult={onResult} />
      </div>
      {(hideBoard && placeholder?.({ result, api: boardApi })) || null}
    </div>
  );
}
