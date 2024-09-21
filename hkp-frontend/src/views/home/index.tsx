import { useContext, useEffect, useState } from "react";
import { Plus, Trash, Send } from "lucide-react";

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
import GenericWidgetResult from "./GenericWidgetResult";
import {
  restoreAdditionalWidgetsFromLocalStorage,
  storeAdditionalWidgetsToLocalStorage,
  WidgetDescriptor,
} from "./common";
import samples from "./samples";
import PostBoardDialog from "./PostBoardDialog";

export default function Home() {
  const board = localStorageBoard as PlaygroundState;
  const appContext = useContext(AppCtx);
  const [visibleTargetBoards, setVisibleTargetBoards] =
    useState<null | Array<string>>(null);

  const onLocalBoardAction = (
    api: BoardWidgetAPI,
    board: SavedBoard,
    { command }: BoardManagerAction,
    boards: Array<SavedBoard>
  ) => {
    switch (command) {
      case "delete":
        removeLocalBoard(board);
        api.runBoard();
        break;
      case "add-widget":
        const source = restoreBoardFromLocalStorage(board.name);
        const params = null;
        if (source) {
          setAdditionalWidgets((all) => [
            ...all,
            { name: board.name, board: source, params },
          ]);
        }
        return;
      case "post-to":
        setVisibleTargetBoards(boards.map((b) => b.name));
        break;
      default:
        console.warn("Unhandled action", command);
        break;
    }
  };

  const [additionalWidgets, setAdditionalWidgets] = useState<
    Array<WidgetDescriptor>
  >([]);

  useEffect(() => {
    const restoredWidgets = restoreAdditionalWidgetsFromLocalStorage();
    setAdditionalWidgets(restoredWidgets);
  }, []);

  useEffect(() => {
    storeAdditionalWidgetsToLocalStorage(additionalWidgets);
  }, [additionalWidgets]);

  const actions = [
    { label: "Delete", value: "delete", icon: Trash },
    { label: "Add Widget to Home", value: "add-widget", icon: Plus },
    { label: "Post to", value: "post-to", icon: Send },
  ];

  const onRemoveWidget = (widgetIdx: number) => {
    setAdditionalWidgets((all) => all.filter((_, idx) => idx !== widgetIdx));
  };

  const onConfigureWidget = (widgetIdx: number, params: any) => {
    setAdditionalWidgets((all) =>
      all.map((item, idx) => (idx === widgetIdx ? { ...item, params } : item))
    );
  };

  const [selectedTargetBoard, setSelectedTargetBoard] = useState<string | null>(
    null
  );

  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full gap-4">
        <BoardWidget
          title="A widget enumerating boards stored in the local storage of this Browser"
          board={board}
          removable={false}
        >
          {({ result: boards, api }) => (
            <BoardManager
              title="Local Boards"
              boards={boards}
              actions={actions}
              onAction={(board: SavedBoard, action: BoardManagerAction) =>
                onLocalBoardAction(api, board, action, boards)
              }
              pageSize={5}
            />
          )}
        </BoardWidget>

        {additionalWidgets.map((item, idx) => (
          <BoardWidget
            key={`home-widget-${item.name}-${idx}`}
            user={appContext.user}
            board={item.board}
            title={item.board.description || item.name}
            params={item.params}
            onRemoveWidget={() => onRemoveWidget(idx)}
            onConfig={(config) => onConfigureWidget(idx, config)}
          >
            {({ result }) =>
              result ? <GenericWidgetResult value={result} /> : null
            }
          </BoardWidget>
        ))}

        <BoardManager
          title="Sample Boards"
          boards={samples}
          hideSearch
          startCollapsed={true}
          dateFormat="DD/MM/YYYY"
        />

        <PostBoardDialog
          user={appContext.user}
          boards={visibleTargetBoards}
          selectedBoard={selectedTargetBoard}
          onSelectionChanged={setSelectedTargetBoard}
          onClose={() => setVisibleTargetBoards(null)}
        />
      </div>
    </Template>
  );
}
