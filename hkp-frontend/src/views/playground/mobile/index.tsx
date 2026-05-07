import { withRouter } from "../../../common";
import BoardProvider from "../../../BoardContext";
import { usePlaygroundController } from "../PlaygroundController";
import { PlaygroundProps } from "../Playground.types";
import { RuntimeApiMap } from "../../../types";
import browserRuntimeApi from "../../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../../runtime/graphql/RuntimeGraphQLApi";
import runtimeRestApi from "../../../runtime/rest/RuntimeRestApi";
import MobilePlaygroundInner from "./MobilePlaygroundInner";

const runtimeApis: RuntimeApiMap = {
  browser: browserRuntimeApi,
  remote: remoteRuntimeApi,
  graphql: remoteRuntimeApi,
  realtime: runtimeRestApi,
  rest: runtimeRestApi,
};

function MobilePlayground(props: PlaygroundProps) {
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
        onSaveBoard={() => saveBoard(true)}
      />
    </BoardProvider>
  );
}

export const MobilePlaygroundWithRouter = withRouter(MobilePlayground);
export default MobilePlaygroundWithRouter;
