import { ReactNode, useContext } from "react";

import { BoardCtx } from "../../BoardContext";
import { useTheme, useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";

import RuntimeMenu from "hkp-frontend/src/ui-components/toolbar/RuntimeMenu";
import HomeIcon from "./HomeIcon";

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
  menuSlot?: ReactNode;
  onUpdateAvailableRuntimeEngines?: (
    runtimeClasses: Array<RuntimeClass>,
  ) => void;
};

export default function Toolbar({
  showRuntimeMenu = false,
  children = false,
  hideNavigation = false,
  menuItemFactory,
  menuSlot,
  onUpdateAvailableRuntimeEngines,
}: Props) {
  const boardContext = useContext(BoardCtx);

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
    overwriteIfExists: boolean = false,
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

  const theme = useTheme();
  const { themeName } = useThemeControl();
  const isSketch = themeName === "sketch";

  const outerStyle = isSketch
    ? {
        position: "sticky" as const,
        left: 0,
        top: 0,
        zIndex: 100,
        width: "100%",
        background: "#fafafa",
        borderBottom: `2px solid ${theme.borderColor}`,
        boxShadow: "3px 3px 0px rgba(0,0,0,0.06)",
      }
    : {
        position: "sticky" as const,
        left: 0,
        top: 0,
        zIndex: 100,
        borderTop: "1px solid #ddd",
        width: "100%",
      };

  const innerBorderBottom = isSketch ? "none" : "1px solid #ccc";

  return (
    <div
      data-toolbar
      className={isSketch ? "select-none w-full" : "select-none w-full bg-gradient-to-r from-white from-20% to-zinc-100 to-100% shadow-[0_2px_3px_rgba(0,0,0,0.10)]"}
      style={outerStyle}
    >
      <div
        className="w-full mb-0 mt-0"
        style={{
          textAlign: "left",
          borderBottom: innerBorderBottom,
          width: "100%",
        }}
      >
        <div className="w-full flex items-center" style={{ width: "100%" }}>
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

          {menuSlot ?? (!hideNavigation && <AppMenu />)}
        </div>
      </div>
    </div>
  );
}
