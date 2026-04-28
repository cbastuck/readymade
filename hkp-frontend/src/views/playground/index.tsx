import { withRouter } from "../../common";

import BoardProvider from "../../BoardContext";

import { generateRandomName } from "../../core/board";

import { usePlaygroundController } from "./PlaygroundController";
import PlaygroundInner from "./PlaygroundInner";
import { PlaygroundProps } from "./Playground.types";

import { RuntimeApiMap } from "../../types";
import browserRuntimeApi from "../../runtime/browser/BrowserRuntimeApi";
import remoteRuntimeApi from "../../runtime/graphql/RuntimeGraphQLApi";
import runtimeRestApi from "../../runtime/rest/RuntimeRestApi";

export const runtimeApis: RuntimeApiMap = {
  browser: browserRuntimeApi,
  remote: remoteRuntimeApi,
  graphql: remoteRuntimeApi,
  realtime: runtimeRestApi,
  rest: runtimeRestApi,
};

function Playground(props: PlaygroundProps) {
  const {
    boardProviderRef,
    currentUser,
    requestedBoardName,
    description,
    isSaveDialogVisible,
    setIsSaveDialogVisible,
    showShareBoardQRCodeURL,
    setShowShareBoardQRCodeURL,
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
    onSaveDialog,
    onChangeBoardname,
  } = usePlaygroundController(props);

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
      <PlaygroundInner
        description={description}
        compact={props.compact}
        hideNavigation={props.hideNavigation}
        menuSlot={props.menuSlot}
        logoSlot={props.logoSlot}
        menuItemFactory={props.menuItemFactory}
        showShareBoardQRCodeURL={showShareBoardQRCodeURL}
        setShowShareBoardQRCodeURL={setShowShareBoardQRCodeURL}
        isSaveDialogVisible={isSaveDialogVisible}
        suggestedName={
          (props.match && props.match.params && props.match.params.board) ||
          props.boardName ||
          generateRandomName()
        }
        onSaveDialog={onSaveDialog}
        setIsSaveDialogVisible={setIsSaveDialogVisible}
        onChangeBoardname={onChangeBoardname}
        onUpdateAvailableRuntimeEngines={props.onUpdateAvailableRuntimeEngines}
        requestedBoardName={props.boardName || requestedBoardName}
        emptySlot={props.emptySlot}
      >
        {props.children}
      </PlaygroundInner>
    </BoardProvider>
  );
}

const PlaygroundWithRouter = withRouter(Playground);
export default PlaygroundWithRouter;
