import { RotateCw } from "lucide-react";

import { PlaygroundState } from "@/types";
import WrappedBoard from "./WrappedBoard";
import { BoardWidgetAPI } from ".";
import IconButton from "@/ui-components/IconButton";
import BoardWidgetSettings from "./BoardWidgetSettings";

type Props = {
  title?: string;
  placeholder?: (result: any) => React.ReactElement;
  board: PlaygroundState;
  hideBoard?: boolean;
  result: any;
  toggleIcon?: React.ComponentType;
  boardApi: BoardWidgetAPI | null;
  onResult: (result: { result: any; api: BoardWidgetAPI }) => void;
  onToggleVisibility: () => void;
  onRemoveWidget?: () => void;
};

export default function BoardWidgetFrame({
  title,
  placeholder,
  board,
  hideBoard,
  result,
  toggleIcon,
  boardApi,
  onResult,
  onToggleVisibility,
  onRemoveWidget,
}: Props) {
  const onRunBoard = () => {
    boardApi && boardApi.runBoard();
  };

  return (
    <div
      className={
        hideBoard
          ? "border border-gray px-0"
          : "solid border border-gray w-full"
      }
    >
      <div className="flex w-full py-2 px-2 m-0 gap-2 bg-gray-100">
        <span className="w-full text-base ">{title}</span>
        <BoardWidgetSettings onRemoveWidget={onRemoveWidget} />
        <IconButton onClick={onRunBoard} icon={RotateCw} />
        <IconButton onClick={onToggleVisibility} icon={toggleIcon} />
      </div>

      <div className="px-4">
        <WrappedBoard board={board} hidden={hideBoard} onResult={onResult} />
      </div>

      <div className="p-1">
        {(hideBoard && placeholder?.({ result, api: boardApi })) || null}
      </div>
    </div>
  );
}
