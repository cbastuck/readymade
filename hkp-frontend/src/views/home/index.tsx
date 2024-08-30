import { useContext, useState } from "react";
import { Plus } from "lucide-react";
import Template from "../Template";
import BoardComponent, { BoardAPI } from "../../components/BoardComponent";
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
    api: BoardAPI,
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
    { label: "Add to Home", value: "add-provider", icon: Plus },
  ];

  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <BoardComponent board={board}>
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
          </BoardComponent>

          {additionalBoardProviders.map((item, idx) => (
            <BoardComponent
              user={appContext.user}
              board={item.board}
              key={`board-component-${item.name}-${idx}`}
            >
              {({ result: boards }) => (
                <div key={`board-output-${item.name}-${idx}`}>
                  {JSON.stringify(boards)}
                </div>
              )}
            </BoardComponent>
          ))}
        </div>
      </div>
    </Template>
  );
}
