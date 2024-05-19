import { useCallback, useEffect, useRef, useState } from "react";

import BoardProvider, {
  BoardConsumer,
  BoardContextState,
} from "../../../BoardContext";
import Button from "../../../components/shared/Button";
import SelectorField from "../../../components/shared/SelectorField";
import browserRuntimeApi from "../../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../../runtime/remote/RemoteRuntimeApi";
import {
  AppImpl,
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  RuntimeApiMap,
  SavedBoard,
  ServiceClass,
  ServiceImpl,
  SidechainRouting,
} from "../../../types";
import Board from "../../../views/playground/Board";
import {
  getLocalBoard,
  getLocalBoards,
} from "../../../views/playground/common";
import ServiceUI from "../../services/ServiceUI";

const serviceId = "hookup.to/service/board-service";
const serviceName = "Board-Service";

type Props = {};
type Config = {
  result: any;
  selectedBoard: string;
  command?: {
    action: string;
    params: any;
    promise?: { resolve: (result: any) => void; reject: (err: Error) => void };
  };
};

function BoardServiceUI(props: Props) {
  const [inputRouting, setInputRouting] = useState<RuntimeInputRoutings>({});
  const [outputRouting, setOutputRouting] = useState<RuntimeOutputRoutings>({});
  const [sidechainRouting, setSidechainRouting] = useState<SidechainRouting>(
    {}
  );

  const [savedBoards, setSavedBoards] = useState<Array<SavedBoard>>([]);
  useEffect(() => setSavedBoards(getLocalBoards()), []);

  const [selectedSavedBoard, setSelectedSavedBoard] = useState("");

  const boardProviderRef = useRef<BoardProvider | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (selectedSavedBoard) {
      boardProviderRef.current?.fetchBoard();
    }
  }, [selectedSavedBoard]);

  const onUpdate = useCallback((update: Partial<Config>) => {
    if (update.selectedBoard !== undefined) {
      setSelectedSavedBoard(update.selectedBoard);
    }
  }, []);

  const onInit = useCallback(
    (initialState: Partial<Config>) => onUpdate(initialState),
    [onUpdate]
  );

  const pendingPromise = useRef<any>(null);

  const processSingle = async (params: any) => {
    return new Promise((resolve, reject) => {
      pendingPromise.current = { resolve, reject };
      boardProviderRef.current?.onAction({
        type: "playBoard",
        params,
      });
    });
  };

  const process = async (params: any | Array<any>) => {
    if (Array.isArray(params)) {
      const results = [];
      for (const p of params) {
        const r: any = await processSingle(p);
        const input = p; // typeof p === "string" ? p : JSON.stringify(p);
        results.push({ params: input, value: r });
      }
      return results;
    } else {
      const result = await processSingle(params);
      return result;
    }
  };

  const onNotification = async (notification: Partial<Config>) => {
    if (notification.command) {
      if (notification.command.action === "process") {
        const result = await process(notification.command.params);
        const resolver = notification.command.promise?.resolve;
        if (!resolver) {
          throw new Error("BoardService.onNotification, no resolver available");
        }
        resolver(result);
      }
    } else {
      onUpdate(notification);
    }
  };

  const selectedBoard = selectedSavedBoard || savedBoards[0]?.name || "";

  const fetchBoard = useCallback(() => {
    if (!selectedBoard) {
      return null;
    }
    const data = getLocalBoard(selectedBoard);
    if (!data) {
      throw new Error(`Board with name: '${selectedBoard}' was not found`);
    }
    const board = data && JSON.parse(data);
    const { inputRouting, outputRouting, sidechainRouting } = board || {};
    if (inputRouting !== undefined) {
      setInputRouting(inputRouting);
    }
    if (outputRouting !== undefined) {
      setOutputRouting(outputRouting);
    }
    if (sidechainRouting !== undefined) {
      setSidechainRouting(sidechainRouting);
    }
    return board;
  }, [selectedBoard]);

  const onChangeSavedBoard = useCallback(
    (boardContext: BoardContextState, board: string) => {
      setSelectedSavedBoard(board);
      setTimeout(() => boardContext.fetchBoard(), 100);
    },
    []
  );

  const onEdit = useCallback(() => {
    window.open(`/playground/${selectedBoard}`, "_blank");
  }, [selectedBoard]);

  const onToggleExpandCollapse = () =>
    setIsExpanded((isExpanded) => !isExpanded);

  const runtimeApis: RuntimeApiMap = {
    browser: browserRuntimeApi,
    remote: remoteRuntimeApi,
  };

  const renderMain = (service: ServiceImpl) => {
    const user = service.app.getAuthenticatedUser();

    const onResult = async (result: any) => {
      if (pendingPromise.current) {
        pendingPromise.current.resolve(result);
        pendingPromise.current = null;
      }
    };

    return (
      <BoardProvider
        ref={boardProviderRef}
        fetchBoard={fetchBoard}
        runtimeApis={runtimeApis}
        user={user}
        boardName="board-service-board"
        availableRuntimes={[]}
      >
        <BoardConsumer>
          {(boardContext) =>
            boardContext && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  height: "100%",
                  marginBottom: "5px",
                  minWidth: "250px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    padding: "2px 0px",
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
                    onChange={({ value: board }) => {
                      service.configure({ selectedBoard: board });
                      onChangeSavedBoard(boardContext, board);
                    }}
                  />
                  <Button
                    icon={"external alternate"}
                    size="tiny"
                    style={{
                      width: "50px",
                      height: "33px",
                    }}
                    onClick={onEdit}
                  />
                </div>

                <SelectorField
                  label="Input"
                  value="array"
                  options={{
                    array: "process array items",
                    whole: "process whole array ",
                  }}
                  onChange={() => {}}
                />

                <Button
                  style={{
                    height: "15px",
                    marginTop: 5,
                    padding: 0,
                    width: "100%",
                    borderRadius: 1,
                  }}
                  onClick={onToggleExpandCollapse}
                  icon={isExpanded ? "angle up" : "angle down"}
                />

                <div
                  style={{
                    height: "100%",
                    maxHeight: isExpanded ? 1000 : 0,
                    opacity: isExpanded ? 1 : 0,
                    width: "100%",
                    maxWidth: isExpanded ? 1000 : 10,
                    transition: "max-height 1s, max-width 0.5s, opacity 2.0s",
                  }}
                >
                  <Board
                    inputRouting={inputRouting}
                    outputRouting={outputRouting}
                    boardContext={boardContext}
                    sidechainRouting={sidechainRouting}
                    boardName={selectedBoard}
                    onChangeOutputRouting={() => {}}
                    onChangeInputRouting={() => {}}
                    onChangeSidechainRouting={() => {}}
                    onResult={onResult}
                    headless={!isExpanded}
                  />
                </div>
              </div>
            )
          }
        </BoardConsumer>
      </BoardProvider>
    );
  };

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
  selectedBoard: string | null = null;

  constructor(
    app: AppImpl,
    board: string,
    _descriptor: ServiceClass,
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

    if (config.selectedBoard !== undefined) {
      this.selectedBoard = config.selectedBoard;
    }
  }

  async destroy() {}

  process(params: any) {
    return new Promise((resolve, reject) => {
      this.app.notify(this, {
        command: {
          action: "process",
          params,
          promise: { resolve, reject },
        },
      });
    });
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
