import { withRouter } from "../../../common";
import BoardProvider from "../../../BoardContext";
import { usePlaygroundController } from "../PlaygroundController";
import { PlaygroundProps } from "../Playground.types";
import { RuntimeApiMap } from "../../../types";
import browserRuntimeApi from "../../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../../runtime/graphql/RuntimeGraphQLApi";
import runtimeRestApi from "../../../runtime/rest/RuntimeRestApi";
import MobilePlaygroundInner from "./MobilePlaygroundInner";
import type { OpenCloudBoardSignal } from "../../cloud/mobile/MobileCloudBoards";

const runtimeApis: RuntimeApiMap = {
  browser: browserRuntimeApi,
  remote: remoteRuntimeApi,
  graphql: remoteRuntimeApi,
  realtime: runtimeRestApi,
  rest: runtimeRestApi,
};

type MobilePlaygroundProps = PlaygroundProps & {
  /** Navigates back to the host's start page (renders a home button). */
  onHome?: () => void;
  /** Cloud board to open on arrival — boots into the Cloud tab with that
   *  board hydrated instead of the local board. */
  openCloudBoard?: OpenCloudBoardSignal;
};

function MobilePlayground(props: MobilePlaygroundProps) {
  const {
    boardProviderRef,
    currentUser,
    requestedBoardName,
    playgroundRuntimeEngines,
    fetchBoard,
    onRemoveRuntime,
    newBoard,
    onClearPlayground,
    saveBoard,
    isActionAvailable,
    serializeBoard,
    onUpdateBoardState,
    onAction,
    unitOrigin,
  } = usePlaygroundController(props);

  const suggestedName =
    (props.match && props.match.params && props.match.params.board) ||
    props.boardName ||
    requestedBoardName;

  return (
    <BoardProvider
      ref={boardProviderRef}
      user={currentUser}
      initialBoardName={requestedBoardName}
      fetchBoard={fetchBoard}
      unitOrigin={unitOrigin}
      isRuntimeInScope={() => true}
      runtimeApis={runtimeApis}
      onRemoveRuntime={onRemoveRuntime}
      newBoard={newBoard}
      onClearBoard={onClearPlayground}
      saveBoard={saveBoard}
      isActionAvailable={isActionAvailable}
      serializeBoard={serializeBoard}
      onUpdateBoardState={onUpdateBoardState}
      onAction={onAction}
      onRemoveService={() => {}}
      availableRuntimeEngines={playgroundRuntimeEngines}
      onBoardInfrastructureChange={props.onBoardInfrastructureChange}
    >
      <MobilePlaygroundInner
        suggestedName={suggestedName}
        onHome={props.onHome}
        openCloudBoard={props.openCloudBoard}
      />
      {/* Host-provided children rendered inside the board context (e.g. the
          Readymade share consumer, which injects a shared item into the open
          board once its runtime is ready). Wrapped so ReactNode satisfies
          BoardProvider's JSX.Element children type. */}
      <>{props.children}</>
    </BoardProvider>
  );
}

export const MobilePlaygroundWithRouter = withRouter(MobilePlayground);
export default MobilePlaygroundWithRouter;
