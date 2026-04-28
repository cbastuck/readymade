import { useBoardContext } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import SaveBoardDialog from "../../components/SaveBoardDialog";
import BoardEntryPoint from "./BoardEntryPoint";
import BoardFetchError from "./BoardFetchError";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { isRuntimeRestClassType, isRuntimeGraphQLClassType } from "../../types";
import { PlaygroundInnerProps } from "./Playground.types";

export default function PlaygroundInner(props: PlaygroundInnerProps) {
  const boardContext = useBoardContext();
  if (!boardContext) {
    return null;
  }

  return (
    <div
      className="w-full h-full bg-neutral-50 flex flex-col"
      style={{ width: "100%" }}
    >
      <Toolbar
        showRuntimeMenu={true}
        onUpdateAvailableRuntimeEngines={(engines) => {
          const filteredEngines = engines.filter(
            (rt) =>
              isRuntimeGraphQLClassType(rt.type) ||
              isRuntimeRestClassType(rt.type),
          );
          if (props.onUpdateAvailableRuntimeEngines) {
            props.onUpdateAvailableRuntimeEngines(filteredEngines);
            return;
          }

          localStorage.setItem(
            "available-remote-runtimes",
            JSON.stringify(filteredEngines),
          );
        }}
        isCompact={props.compact}
        menuItemFactory={props.menuItemFactory}
        hideNavigation={props.hideNavigation}
        menuSlot={props.menuSlot}
        logoSlot={props.logoSlot}
        includeNavigationLinks={!props.hideNavigation}
      />

      <ShareQRCodeDialog
        isOpen={props.showShareBoardQRCodeURL !== null}
        url={props.showShareBoardQRCodeURL}
        onClose={() => props.setShowShareBoardQRCodeURL(null)}
      />
      <SaveBoardDialog
        isOpen={props.isSaveDialogVisible}
        suggestedName={props.suggestedName}
        suggestedDescription={props.description}
        onSave={props.onSaveDialog}
        onCancel={() => props.setIsSaveDialogVisible(false)}
      />
      {boardContext.errorOnFetch ? (
        <BoardFetchError
          boardName={boardContext.boardName || props.requestedBoardName || ""}
          error={boardContext.errorOnFetch}
        />
      ) : (
        <BoardEntryPoint
          className="pt-2"
          isLoading={boardContext.isFetching || !!boardContext.awaitUserLogin}
          showLoginRequired={!!boardContext.awaitUserLogin}
          boardContext={boardContext}
          requestedBoardName={props.requestedBoardName}
          description={props.description}
          onChangeBoardname={props.onChangeBoardname}
          emptySlot={props.emptySlot}
        />
      )}
      <Footer />
      {props.children || null}
    </div>
  );
}
