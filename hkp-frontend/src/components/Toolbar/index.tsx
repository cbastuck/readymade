import { useContext } from "react";
import { Menu } from "semantic-ui-react";

import { BoardCtx } from "../../BoardContext";

import RuntimeMenu from "@/ui-components/toolbar/RuntimeMenu";
import HomeIcon from "./HomeIcon";
import NavigationBar from "./NavigationBar";

import AppMenu from "@/ui-components/toolbar/AppMenu";

import { RuntimeClass } from "../../types";
import BoardActionsBar from "./BoardActionsBar";
import BoardMenu from "@/ui-components/toolbar/BoardMenu";

import "./index.css";

type Props = {
  showRuntimeMenu?: boolean;
  isCompact?: boolean;
  onUpdateAvailableRuntimes?: (runtimeClasses: Array<RuntimeClass>) => void;
};

export default function Toolbar({
  showRuntimeMenu = false,
  isCompact = false,
  onUpdateAvailableRuntimes,
}: Props) {
  const showBoardActions = false;
  const boardContext = useContext(BoardCtx);
  const renderWide = boardContext?.appContext?.appViewMode === "wide";
  return (
    <div
      style={{
        position: "sticky",
        left: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          marginTop: 0,
          marginBottom: 5,
          textAlign: "left",
          borderBottom: "1px solid rgba(34,36,38,.15)",
          borderTop: "1px solid #ddd",
        }}
      >
        <Menu
          style={{
            boxShadow: "none",
            border: "none",
          }}
        >
          <HomeIcon />
          <BoardMenu />

          {showRuntimeMenu && (
            <RuntimeMenu
              availableRuntimes={boardContext?.availableRuntimes || []}
              onAddAvailableRuntime={(desc) => {
                const runtimes = boardContext?.addAvailableRuntime(desc) || [];
                onUpdateAvailableRuntimes &&
                  onUpdateAvailableRuntimes(runtimes);
              }}
              onRemoveAvailableRuntime={(desc) => {
                const runtimes =
                  boardContext?.removeAvailableRuntime(desc) || [];
                onUpdateAvailableRuntimes &&
                  onUpdateAvailableRuntimes(runtimes);
              }}
              onAddRuntime={(rtClass: RuntimeClass) =>
                boardContext?.addRuntime(rtClass)
              }
            />
          )}
          {showBoardActions && renderWide && (
            <div style={{ marginLeft: "5px" }}>
              <BoardActionsBar boardContext={boardContext} />
            </div>
          )}

          {!isCompact && <NavigationBar />}
          <AppMenu isCompact={isCompact} />
        </Menu>
      </div>
    </div>
  );
}
