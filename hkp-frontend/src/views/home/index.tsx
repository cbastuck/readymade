import { useContext, useEffect, useState } from "react";
import { Plus, Trash, Send, Settings } from "lucide-react";

import Template from "../Template";
import BoardWidget, { BoardWidgetAPI } from "../../components/BoardWidget";
import { PlaygroundState, SavedBoard } from "hkp-frontend/src/types";
import BoardManager from "hkp-frontend/src/ui-components/boardmanager";

import localStorageBoard from "./localStorageRetriever.json";
import { BoardManagerAction } from "hkp-frontend/src/ui-components/boardmanager/BoardTable";
import {
  removeLocalBoard,
  restoreBoardFromLocalStorage,
} from "../playground/common";
import { AppCtx } from "hkp-frontend/src/AppContext";
import GenericWidgetResult from "./GenericWidgetResult";
import {
  restoreAdditionalWidgetsFromLocalStorage,
  storeAdditionalWidgetsToLocalStorage,
  WidgetDescriptor,
} from "./common";

import PostBoardDialog from "./PostBoardDialog";

type PostBoardState = {
  selectedBoard: string;
  targetBoards: Array<string>;
};

export default function Home() {
  const board = localStorageBoard as PlaygroundState;
  const appContext = useContext(AppCtx);
  const [postBoardState, setPostBoardState] = useState<PostBoardState | null>(
    null
  );

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
      case "add-widget": {
        const source = restoreBoardFromLocalStorage(board.name);
        const params = null;
        if (source) {
          setAdditionalWidgets((all) => [
            ...all,
            { name: board.name, board: source, params },
          ]);
        }
        return;
      }
      case "post-to":
        setPostBoardState({
          targetBoards: boards.map((b) => b.name),
          selectedBoard: board.name,
        });
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
    <Template title="Home" isRoot={true} compactToolbar={false}>
      <div className="text-base tracking-widest leading-6 flex flex-col h-full gap-4 mt-2 mb-8">
        <div className="my-8">
          This is your space. Everything here is based on the output of a board
          displayed through widgets. Currently, there are only two widget types,
          and your home space initially contains exactly one widget that lists
          the boards you have stored locally within this particular browser.
          <div className="mt-2">
            Click on the <Settings size={16} className="inline" /> icon to peek
            into the board that produces the data for this prebuilt widget. More
            widget types, including custom ones, will be added in the future.
          </div>
        </div>
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

        <PostBoardDialog
          user={appContext.user}
          sourceBoard={postBoardState?.selectedBoard || null}
          targetBoards={postBoardState?.targetBoards || null}
          selectedBoard={selectedTargetBoard}
          onSelectionChanged={setSelectedTargetBoard}
          onClose={() => setPostBoardState(null)}
        />
      </div>
    </Template>
  );
}
