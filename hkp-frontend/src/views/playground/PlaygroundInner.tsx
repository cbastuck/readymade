import { useState } from "react";
import { useBlockSwipeNavigation } from "../../runtime/useBlockSwipeNavigation";
import { useBoardContext } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import SaveBoardDialog from "../../components/SaveBoardDialog";
import DeployMenu from "../../components/Toolbar/DeployMenu";
import BoardEntryPoint from "./BoardEntryPoint";
import BoardFetchError from "./BoardFetchError";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { RuntimeClass } from "../../types";
import { PlaygroundInnerProps } from "./Playground.types";
import Sidebar from "./Sidebar";
import { RemoteRuntimeStoreCtx } from "../../ui-components/toolbar/useRemoteRuntimeEditing";
import { useThemeControl } from "../../ui-components/ThemeContext";
import { HKP_DND_RUNTIME_CLASS_TYPE } from "../../components/DropTypes";
import NestedNavProvider from "../../runtime/ui/NestedNavigation";
import { OverviewProvider } from "../../overview/OverviewContext";
import OverviewView from "../../overview/OverviewView";
import OverviewToolbarButton from "../../overview/OverviewToolbarButton";
import { FacadeViewProvider } from "../../facade/FacadeViewContext";
import {
  SelectionProvider,
  useSelection,
} from "../../selection/SelectionContext";
import FacadeViewControls from "../../facade/FacadeViewControls";
import FacadeChrome, { useChromeRetracted } from "../../facade/FacadeChrome";

export default function PlaygroundInner(props: PlaygroundInnerProps) {
  const boardContext = useBoardContext();
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";

  if (!boardContext) {
    return null;
  }

  return (
    <RemoteRuntimeStoreCtx.Provider value={props.remoteRuntimeStore ?? null}>
      <SelectionProvider runtimeIds={boardContext.runtimes.map((rt) => rt.id)}>
        <OverviewProvider>
          <FacadeViewProvider
            boardName={boardContext.boardName || props.requestedBoardName || ""}
          >
            <div
              className="w-full h-full flex flex-col"
              style={{
                width: "100%",
                background: "var(--bg-app, #fafafa)",
                // What the retracted bar and its logo are placed against: while
                // the facade is the app they are painted over it rather than
                // taking a row of their own.
                position: "relative",
              }}
            >
              <FacadeChrome>
                <Toolbar
                  isCompact={props.compact}
                  menuItemFactory={props.menuItemFactory}
                  hideNavigation={props.hideNavigation}
                  menuSlot={props.menuSlot}
                  logoSlot={props.logoSlot}
                  actionsSlot={
                    <>
                      <FacadeViewControls />
                      <OverviewToolbarButton />
                      <DeployMenu />
                    </>
                  }
                  includeNavigationLinks={!props.hideNavigation}
                />
              </FacadeChrome>

              <ShareQRCodeDialog
                isOpen={props.showShareBoardQRCodeURL !== null}
                url={props.showShareBoardQRCodeURL}
                onClose={() => props.setShowShareBoardQRCodeURL(null)}
              />
              <SaveBoardDialog
                isOpen={props.isSaveDialogVisible}
                suggestedName={boardContext.boardName || props.suggestedName}
                suggestedDescription={props.description}
                onSave={props.onSaveDialog}
                onCancel={() => props.setIsSaveDialogVisible(false)}
              />

              {/* Main area: sidebar + board canvas */}
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {isPlayground && <Sidebar />}
                {/* Levels drilled into nested pipelines cover the canvas and nothing
              else, so the trail out of them sits above the board rather than
              above the whole window. */}
                <NestedNavProvider
                  rootLabel={boardContext.boardName || "Board"}
                >
                  <BoardCanvas
                    boardContext={boardContext}
                    isPlayground={isPlayground}
                    requestedBoardName={props.requestedBoardName}
                    description={props.description}
                    onChangeBoardname={props.onChangeBoardname}
                    emptySlot={props.emptySlot}
                  />

                  {/* Covers the window rather than taking a pane, and reads the levels
                from here so clicking a node can open the one it sits on. */}
                  <OverviewView />
                </NestedNavProvider>
              </div>

              <ChromeFooter />
              {props.children || null}
            </div>
          </FacadeViewProvider>
        </OverviewProvider>
      </SelectionProvider>
    </RemoteRuntimeStoreCtx.Provider>
  );
}

/**
 * The copyright strip, unless the facade is the app.
 *
 * Its own component because the state that decides this is provided by this
 * file's own render, and only something mounted inside that provider can read
 * it. Retracting the bar and leaving the footer would trade one strip of
 * chrome for another.
 */
function ChromeFooter() {
  return useChromeRetracted() ? null : <Footer />;
}

/**
 * The board itself, and what can be dropped onto it.
 *
 * Its own component rather than part of PlaygroundInner because the selection
 * is provided there: a runtime dropped here becomes the selected one, and only
 * something mounted inside the provider can say so.
 */
function BoardCanvas({
  boardContext,
  isPlayground,
  requestedBoardName,
  description,
  onChangeBoardname,
  emptySlot,
}: {
  boardContext: NonNullable<ReturnType<typeof useBoardContext>>;
  isPlayground: boolean;
  requestedBoardName?: string;
  description: string;
  onChangeBoardname: (newName: string) => void;
  emptySlot?: React.ReactNode;
}) {
  const selection = useSelection();
  const [isRtClassDragOver, setIsRtClassDragOver] = useState(false);
  const boardCanvasRef = useBlockSwipeNavigation<HTMLDivElement>();

  return (
    <div
      className={
        isRtClassDragOver ? "hkp-board-runtime-drop-active" : undefined
      }
      ref={boardCanvasRef}
      style={{
        flex: 1,
        overflow: "auto",
        overscrollBehaviorX: "none",
        display: "flex",
        flexDirection: "column",
        ...(isPlayground
          ? {
              background:
                "oklch(0.966 0.007 62) radial-gradient(circle, oklch(0.76 0.012 62) 1px, transparent 1px) 0 0 / 22px 22px",
            }
          : {}),
      }}
      onDragOver={(ev) => {
        if (ev.dataTransfer.types.includes(HKP_DND_RUNTIME_CLASS_TYPE)) {
          setIsRtClassDragOver(true);
          ev.preventDefault();
        }
      }}
      onDragLeave={() => setIsRtClassDragOver(false)}
      onDrop={async (ev) => {
        const data = ev.dataTransfer.getData(HKP_DND_RUNTIME_CLASS_TYPE);
        if (data) {
          setIsRtClassDragOver(false);
          const rtClass: RuntimeClass = JSON.parse(data);
          ev.preventDefault();
          // Dropping a runtime is how a person says which one they mean, and
          // it is the last thing they did — so the selection follows it here
          // rather than waiting for a click that a webview may still be
          // swallowing after the drag that put it there.
          const added = await boardContext.addRuntime({
            ...rtClass,
            name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
          });
          if (added) {
            selection?.selectRuntime(added.id);
          }
        }
      }}
    >
      {boardContext.errorOnFetch ? (
        <BoardFetchError
          boardName={boardContext.boardName || requestedBoardName || ""}
          error={boardContext.errorOnFetch}
          boardContext={boardContext}
        />
      ) : (
        <BoardEntryPoint
          isLoading={boardContext.isFetching || !!boardContext.awaitUserLogin}
          showLoginRequired={!!boardContext.awaitUserLogin}
          boardContext={boardContext}
          requestedBoardName={requestedBoardName}
          description={description}
          onChangeBoardname={onChangeBoardname}
          emptySlot={emptySlot}
        />
      )}
    </div>
  );
}
