import { useCallback, useContext } from "react";

import ServiceUI from "../../services/ServiceUI";
import {
  AppImpl,
  RuntimeApiMap,
  ServiceClass,
  ServiceImpl,
} from "../../../types";
import BoardProvider, { BoardConsumer } from "../../../BoardContext";
import Board from "../../../views/playground/Board";
import { AppCtx } from "../../../AppContext";
import browserRuntimeApi from "../../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../../runtime/remote/RemoteRuntimeApi";

const serviceId = "hookup.to/service/board-service";
const serviceName = "Board-Service";

type Props = {};
type Config = {
  result: any;
};

function BoardServiceUI(props: Props) {
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

  const appContext = useContext(AppCtx);

  const boardName = "simple-counter";
  const fetchBoard = () => {
    const data = localStorage.getItem(`hkp-playground-${boardName}`);
    const board = data && JSON.parse(data);
    return board;
  };

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
                  <Board
                    appContext={appContext}
                    inputRouting={{}}
                    outputRouting={{}}
                    boardContext={boardContext}
                    sidechainRouting={{}}
                    boardName={boardName}
                    description={`Wrapped '${boardName}' board`}
                    onChangeOutputRouting={() => {}}
                    onChangeInputRouting={() => {}}
                    onChangeSidechainRouting={() => {}}
                    headless={true}
                    onResult={onResult}
                  />
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
