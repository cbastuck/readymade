import { useState } from "react";
import { useBoardContext } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "hkp-frontend/src/components/Footer";
import SaveBoardDialog from "../../components/SaveBoardDialog";
import BoardEntryPoint from "./BoardEntryPoint";
import BoardFetchError from "./BoardFetchError";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { RuntimeClass } from "../../types";
import { PlaygroundInnerProps } from "./Playground.types";
import Sidebar from "./Sidebar";
import { useThemeControl } from "../../ui-components/ThemeContext";
import { HKP_DND_RUNTIME_CLASS_TYPE } from "../../components/DropTypes";

export default function PlaygroundInner(props: PlaygroundInnerProps) {
  const boardContext = useBoardContext();
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  const [isRtClassDragOver, setIsRtClassDragOver] = useState(false);

  if (!boardContext) {
    return null;
  }

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ width: "100%", background: "var(--bg-app, #fafafa)" }}
    >
      <Toolbar
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

      {/* Main area: sidebar + board canvas */}
      <div
        style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        {isPlayground && <Sidebar />}
        <div
          className={
            isRtClassDragOver ? "hkp-board-runtime-drop-active" : undefined
          }
          style={{
            flex: 1,
            overflow: "auto",
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
          onDrop={(ev) => {
            const data = ev.dataTransfer.getData(HKP_DND_RUNTIME_CLASS_TYPE);
            if (data) {
              setIsRtClassDragOver(false);
              const rtClass: RuntimeClass = JSON.parse(data);
              boardContext.addRuntime({
                ...rtClass,
                name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
              });
              ev.preventDefault();
            }
          }}
        >
          {boardContext.errorOnFetch ? (
            <BoardFetchError
              boardName={
                boardContext.boardName || props.requestedBoardName || ""
              }
              error={boardContext.errorOnFetch}
            />
          ) : (
            <BoardEntryPoint
              className="pt-2"
              isLoading={
                boardContext.isFetching || !!boardContext.awaitUserLogin
              }
              showLoginRequired={!!boardContext.awaitUserLogin}
              boardContext={boardContext}
              requestedBoardName={props.requestedBoardName}
              description={props.description}
              onChangeBoardname={props.onChangeBoardname}
              emptySlot={props.emptySlot}
            />
          )}
        </div>
      </div>

      <Footer />
      {props.children || null}
    </div>
  );
}
