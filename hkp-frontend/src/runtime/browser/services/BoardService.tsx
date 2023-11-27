import { useCallback, useContext, useEffect, useState } from "react";

import ServiceUI from "../../services/ServiceUI";
import {
  AppImpl,
  RuntimeApiMap,
  SavedBoard,
  ServiceClass,
  ServiceImpl,
} from "../../../types";
import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "../../../BoardContext";
import Board from "../../../views/playground/Board";
import { AppCtx } from "../../../AppContext";
import browserRuntimeApi from "../../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../../runtime/remote/RemoteRuntimeApi";
import {
  getLocalBoards,
  localStoragePrefix,
} from "../../../views/playground/common";
import SelectorField from "../../../components/shared/SelectorField";
import { Button } from "semantic-ui-react";

const serviceId = "hookup.to/service/board-service";
const serviceName = "Board-Service";

type Props = {};
type Config = {
  result: any;
};

function BoardServiceUI(props: Props) {
  const [savedBoards, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards(localStoragePrefix)), []);

  const [selectedSavedBoard, setSelectedSavedBoard] = useState("");

  const onUpdate = useCallback((update: Partial<Config>) => {}, []);

  const onInit = useCallback(
    (initialState: Partial<Config>) => onUpdate(initialState),
    [onUpdate]
  );

  const onNotification = useCallback(
    (service: BoardService, notification: Partial<Config>) =>
      onUpdate(notification),
    [onUpdate]
  );

  const selectedBoard = selectedSavedBoard || savedBoards[0]?.name || "";

  const appContext = useContext(AppCtx);

  const fetchBoard = useCallback(() => {
    const data = localStorage.getItem(`${localStoragePrefix}${selectedBoard}`);
    const board = data && JSON.parse(data);
    return board;
  }, [selectedBoard]);

  const onChangeSavedBoard = useCallback(
    (boardContext: BoardContextState, board: string) => {
      setSelectedSavedBoard(board);
      setTimeout(() => boardContext.fetchBoard(), 100);
    },
    []
  );

  const openSavedBoard = useCallback(() => {
    window.open(`/playground/${selectedBoard}`, "blank");
  }, [selectedBoard]);

  const runtimeApis: RuntimeApiMap = {
    browser: browserRuntimeApi,
    remote: remoteRuntimeApi,
  };

  const renderMain = appContext
    ? (service: ServiceImpl) => {
        const onResult = async (
          uuid: string | null,
          result: any,
          requestId: string | null
        ) => service.configure({ result });

        return (
          <BoardProvider fetchBoard={fetchBoard} runtimeApis={runtimeApis}>
            <BoardConsumer>
              {(boardContext) =>
                boardContext && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100% ",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "row",
                      }}
                    >
                      <SelectorField
                        label="Board"
                        value={selectedBoard}
                        options={savedBoards.reduce(
                          (all, board) => ({
                            ...all,
                            [board.name]: board.name,
                          }),
                          {}
                        )}
                        onChange={(ev, { value: board }) =>
                          onChangeSavedBoard(boardContext, board)
                        }
                      />
                      <Button
                        icon="external alternate"
                        size="tiny"
                        style={{ width: "50px", height: "33px" }}
                        onClick={openSavedBoard}
                      />
                    </div>
                    <Board
                      appContext={appContext}
                      inputRouting={{}}
                      outputRouting={{}}
                      boardContext={boardContext}
                      sidechainRouting={{}}
                      boardName={selectedBoard}
                      onChangeOutputRouting={() => {}}
                      onChangeInputRouting={() => {}}
                      onChangeSidechainRouting={() => {}}
                      headless={true}
                      onResult={onResult}
                    />
                  </div>
                )
              }
            </BoardConsumer>
          </BoardProvider>
        );
      }
    : () => null;

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      segments={[{ name: "main", render: renderMain }]}
    />
  );
}

class BoardService {
  app: AppImpl;
  board: string;
  uuid: string;

  constructor(
    app: AppImpl,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  async configure(config: Partial<Config>) {
    if (config.hasOwnProperty("result")) {
      this.app.next(this, config.result);
    }
  }

  async destroy() {}

  async process(params: any) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new BoardService(app, board, descriptor, id),
  createUI: BoardServiceUI,
};

export default descriptor;
