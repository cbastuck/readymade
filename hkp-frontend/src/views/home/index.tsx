import { useContext, useState } from "react";
import { Plus } from "lucide-react";
import Template from "../Template";
import BoardWidget, { BoardWidgetAPI } from "../../components/BoardWidget";
import { PlaygroundState, SavedBoard } from "@/types";
import BoardManager from "@/ui-components/boardmanager";

import localStorageBoard from "./localStorageRetriever.json";
import { BoardManagerAction } from "@/ui-components/boardmanager/BoardTable";
import {
  removeLocalBoard,
  restoreBoardFromLocalStorage,
} from "../playground/common";
import { AppCtx } from "@/AppContext";

export default function Home() {
  const board = localStorageBoard as PlaygroundState;
  const appContext = useContext(AppCtx);

  const onLocalBoardAction = (
    api: BoardWidgetAPI,
    board: SavedBoard,
    { command }: BoardManagerAction
  ) => {
    switch (command) {
      case "delete":
        removeLocalBoard(board);
        api.runBoard();
        break;
      case "add-provider":
        const restored = restoreBoardFromLocalStorage(board.name);
        if (restored) {
          setAdditionalBoardProviders((all) => [
            ...all,
            { name: board.name, board: restored },
          ]);
        }
        return;
      default:
        break;
    }

    console.log("Unhandled action", command);
  };

  const [additionalBoardProviders, setAdditionalBoardProviders] = useState<
    Array<{ name: string; board: PlaygroundState }>
  >([]);

  const additionalActions = [
    { label: "Add Widget to Home", value: "add-provider", icon: Plus },
  ];

  const onRemoveWidget = (widgetIdx: number) => {
    setAdditionalBoardProviders((all) =>
      all.filter((_, idx) => idx !== widgetIdx)
    );
  };
  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <BoardWidget
            title="Widget listing the boards stored on this Browser"
            board={board}
          >
            {({ result: boards, api }) => (
              <BoardManager
                title="Local Boards"
                boards={boards}
                additionalActions={additionalActions}
                onAction={(board: SavedBoard, action: BoardManagerAction) =>
                  onLocalBoardAction(api, board, action)
                }
              />
            )}
          </BoardWidget>

          {additionalBoardProviders.map((item, idx) => (
            <BoardWidget
              user={appContext.user}
              board={item.board}
              key={`board-component-${item.name}-${idx}`}
              onRemoveWidget={() => onRemoveWidget(idx)}
            >
              {({ result: boards }) => (
                <div key={`board-output-${item.name}-${idx}`}>
                  {JSON.stringify(boards)}
                </div>
              )}
            </BoardWidget>
          ))}
        </div>
      </div>
    </Template>
  );
}
