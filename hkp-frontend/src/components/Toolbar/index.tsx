import { Menu } from "semantic-ui-react";

import { AppConsumer } from "../../AppContext";
import { BoardConsumer } from "../../BoardContext";

import RuntimeMenu from "./RuntimeMenu";
import HomeIcon from "./HomeIcon";
import Navigation from "./Navigation";
import BoardMenu from "./BoardMenu";
import AccountMenu from "./AccountMenu";

import "./index.css";
import { RuntimeClass } from "../../types";
import { BoardContextState } from "../../BoardContext";

type Props = {
  board?: string;
  showRuntimeMenu?: boolean;
  isCompact?: boolean;
  boardSyncActive?: boolean;
  onUpdateAvailableRuntimes?: (runtimeClasses: Array<RuntimeClass>) => void;
};

export default function Toolbar({
  board,
  boardSyncActive = false,
  showRuntimeMenu = false,
  isCompact = false,
  onUpdateAvailableRuntimes,
}: Props) {
  return (
    <AppConsumer>
      {(appContext) => (
        <BoardConsumer>
          {(boardContext: BoardContextState) => (
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
                  {appContext.user && (
                    <BoardMenu
                      boardSyncActive={boardSyncActive}
                      board={board}
                      boardContext={boardContext}
                    />
                  )}

                  {showRuntimeMenu && (
                    <RuntimeMenu
                      isWideViewMode={boardContext.appViewMode === "wide"}
                      availableRuntimes={boardContext.availableRuntimes}
                      onAddAvailableRuntime={(desc) => {
                        const runtimes = boardContext.addAvailableRuntime(desc);
                        onUpdateAvailableRuntimes &&
                          onUpdateAvailableRuntimes(runtimes);
                      }}
                      onRemoveAvailableRuntime={(desc) => {
                        const runtimes =
                          boardContext.removeAvailableRuntime(desc);
                        onUpdateAvailableRuntimes &&
                          onUpdateAvailableRuntimes(runtimes);
                      }}
                      onAddRuntime={({ name, type, url }) =>
                        boardContext.addRuntime(type, name, url)
                      }
                    />
                  )}

                  <Navigation appContext={appContext} isCompact={isCompact} />
                  {appContext && !isCompact && (
                    <AccountMenu
                      appContext={appContext}
                      boardContext={boardContext}
                    />
                  )}
                </Menu>
              </div>
            </div>
          )}
        </BoardConsumer>
      )}
    </AppConsumer>
  );
}
