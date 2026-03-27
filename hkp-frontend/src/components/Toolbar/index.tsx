import { ReactNode, useContext } from "react";

import { BoardCtx } from "../../BoardContext";

import RuntimeMenu from "hkp-frontend/src/ui-components/toolbar/RuntimeMenu";
import HomeIcon from "./HomeIcon";
import NavigationBar from "./NavigationBar";

import AppMenu from "hkp-frontend/src/ui-components/toolbar/AppMenu";

import { BoardMenuItemFactory, RuntimeClass } from "../../types";

import BoardMenu from "hkp-frontend/src/ui-components/toolbar/BoardMenu";

import "./index.css";

type Props = {
  showRuntimeMenu?: boolean;
  children?: ReactNode;
  isCompact?: boolean;
  hideNavigation?: boolean;
  includeNavigationLinks?: boolean;
  menuItemFactory?: BoardMenuItemFactory;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>
  ) => void;
};

export default function Toolbar({
  showRuntimeMenu = false,
  children = false,
  isCompact = undefined,
  hideNavigation = false,
  menuItemFactory,
  onUpdateAvailableRuntimeEngines,
}: Props) {
  const boardContext = useContext(BoardCtx);
  const isNarrow =
    boardContext?.appContext?.appViewMode &&
    boardContext?.appContext?.appViewMode !== "wide";

  const onAddRuntime = (rtClass: RuntimeClass) => {
    if (boardContext) {
      boardContext.addRuntime({
        ...rtClass,
        name: `${rtClass.name} ${boardContext.runtimes.length + 1}`,
      });
    }
  };

  const onAddRuntimeEngine = (
    desc: RuntimeClass,
    overwriteIfExists: boolean = false
  ) => {
    const runtimes =
      boardContext?.addAvailableRuntime(desc, overwriteIfExists) || [];
    onUpdateAvailableRuntimeEngines?.(runtimes);
  };

  const onRemoveRuntimeEngine = (desc: RuntimeClass) => {
    const runtimes = boardContext?.removeAvailableRuntime(desc) || [];
    onUpdateAvailableRuntimeEngines?.(runtimes);
  };

  const onUpdateRuntimeEngine = (updated: RuntimeClass) => {
    onAddRuntimeEngine(updated, true);
  };
  return (
    <div
      className="select-none w-full bg-gradient-to-r from-white from-20% to-zinc-100 to-100% shadow-[0_2px_3px_rgba(0,0,0,0.10)]"
      style={{
        position: "sticky",
        left: 0,
        top: 0,
        zIndex: 100,
        borderTop: "1px solid #ddd",
      }}
    >
      <div
        className="w-full mb-0 mt-0"
        style={{
          textAlign: "left",
          borderBottom: "1px solid #ccc",
        }}
      >
        <div className="w-full flex items-center">
          <div className="pr-1.5">
            <HomeIcon />
          </div>

          <BoardMenu menuItemFactory={menuItemFactory} />

          {!children && showRuntimeMenu && (
            <RuntimeMenu
              availableRuntimeEngines={
                boardContext?.availableRuntimeEngines || []
              }
              onAddAvailableRuntimeEngine={onAddRuntimeEngine}
              onRemoveAvailableRuntimeEngine={onRemoveRuntimeEngine}
              onUpdateRuntimeEngine={onUpdateRuntimeEngine}
              onAddRuntime={onAddRuntime}
            />
          )}

          {children ? children : null}

          {!hideNavigation && (
            <NavigationBar
              isCompact={isCompact === undefined ? isNarrow : isCompact}
            />
          )}

          {!hideNavigation && (
            <AppMenu
              includeNavigationLinks={!hideNavigation && !isCompact && isNarrow}
            />
          )}
        </div>
      </div>
    </div>
  );
}
