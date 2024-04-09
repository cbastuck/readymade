import { useContext } from "react";
import { Menu } from "semantic-ui-react";

import { BoardCtx } from "../../BoardContext";

import RuntimeMenu from "./RuntimeMenu";
import HomeIcon from "./HomeIcon";
import Navigation from "./Navigation";

import AccountMenu from "@/ui-components/AccountMenu";

import { RuntimeClass } from "../../types";
import BoardActionsBar from "./BoardActionsBar";
import BoardMenu from "@/ui-components/BoardMenu";

import "./index.css";

type Props = {
  board?: string;
  showRuntimeMenu?: boolean;
  isCompact?: boolean;
  boardSyncActive?: boolean;
  showBoardActions?: boolean;
  onUpdateAvailableRuntimes?: (runtimeClasses: Array<RuntimeClass>) => void;
};

export default function Toolbar({
  board,
  boardSyncActive = false,
  showRuntimeMenu = false,
  isCompact = false,
  showBoardActions = true,
  onUpdateAvailableRuntimes,
}: Props) {
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
          {board && <BoardMenu boardSyncActive={boardSyncActive} />}

          {showRuntimeMenu && (
            <RuntimeMenu
              isWideViewMode={renderWide}
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

          <Navigation
            appContext={boardContext?.appContext || null}
            isCompact={isCompact}
          />
          {!isCompact && <AccountMenu />}
        </Menu>
      </div>
    </div>
  );
}
