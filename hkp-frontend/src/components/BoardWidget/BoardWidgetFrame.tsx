import { RotateCw } from "lucide-react";

import { BoardDescriptor } from "hkp-frontend/src/types";
import WrappedBoard from "./WrappedBoard";
import { BoardWidgetAPI } from ".";
import IconButton from "hkp-frontend/src/ui-components/IconButton";
import BoardWidgetSettings from "./BoardWidgetSettings";

type Props = {
  title?: string;
  placeholder?: (result: any) => React.ReactElement | null;
  board: BoardDescriptor;
  hideBoard?: boolean;
  result: any;
  toggleIcon?: React.ComponentType;
  boardApi: BoardWidgetAPI | null;
  removable?: boolean;
  params?: any;
  onResult: (result: { result: any; api: BoardWidgetAPI }) => void;
  onToggleVisibility: () => void;
  onRemoveWidget?: () => void;
  onConfig?: (config: any) => void;
};

export default function BoardWidgetFrame({
  title,
  placeholder,
  board,
  hideBoard,
  result,
  toggleIcon,
  boardApi,
  params,
  removable = true,
  onResult,
  onToggleVisibility,
  onRemoveWidget,
  onConfig,
}: Props) {
  const onRunBoard = () => {
    boardApi?.runBoard();
  };

  return (
    <div
      className={
        hideBoard
          ? "border border-gray px-0"
          : "solid border border-gray w-full"
      }
    >
      <div className="flex w-full py-2 px-2 m-0 gap-2 bg-gray-100 items-center">
        <span className="w-full text-base">{title}</span>

        <BoardWidgetSettings
          removable={removable}
          params={params}
          onRemoveWidget={onRemoveWidget}
          onConfig={onConfig}
          board={board}
        />
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
