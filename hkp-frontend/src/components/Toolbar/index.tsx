import { ReactNode } from "react";

import {
  useTheme,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";

import HomeIcon from "./HomeIcon";

import AppMenu from "hkp-frontend/src/ui-components/toolbar/AppMenu";

import { BoardMenuItemFactory } from "../../types";

import BoardMenu from "hkp-frontend/src/ui-components/toolbar/BoardMenu";

import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";

import ShareMenu from "./ShareMenu";
import AccountAvatar from "./AccountAvatar";

import "./index.css";

type Props = {
  children?: ReactNode;
  isCompact?: boolean;
  hideNavigation?: boolean;
  includeNavigationLinks?: boolean;
  menuItemFactory?: BoardMenuItemFactory;
  menuSlot?: ReactNode;
  logoSlot?: ReactNode;
  /** Actions for the view that owns the board — deploying, for one. Passed in
   *  rather than rendered here, because a view that only attaches to a board
   *  has no business offering them. */
  actionsSlot?: ReactNode;
  /** Where the board runs, shown centred between the board menu and the
   *  account controls. Centred by taking it out of the flow, so it stays put
   *  as either side changes width. */
  statusSlot?: ReactNode;
};

/** Holds the status slot in the middle of the bar without letting it push the
 *  controls around, and without swallowing clicks meant for them. */
function CentredStatus({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        maxWidth: "min(46%, 460px)",
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto", minWidth: 0 }}>{children}</div>
    </div>
  );
}

function LogoMark() {
  return (
    <IconH
      className="stroke-[#333] hover:stroke-sky-600"
      width={24}
      height={24}
    />
  );
}

function TbSeparator() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--border-mid, #d1d5db)",
        flexShrink: 0,
        margin: "0 4px",
      }}
    />
  );
}

export default function Toolbar({
  children = false,
  hideNavigation = false,
  menuItemFactory,
  menuSlot,
  logoSlot,
  actionsSlot,
  statusSlot,
}: Props) {
  const theme = useTheme();
  const { themeName } = useThemeControl();
  const isSketch = themeName === "sketch";
  const isPlayground = themeName === "playground";
  if (isPlayground) {
    return (
      <div
        data-toolbar
        className="select-none"
        style={{
          position: "sticky",
          left: 0,
          top: 0,
          zIndex: 100,
          width: "100%",
          height: 52,
          display: "flex",
          alignItems: "center",
          background: "var(--bg-app, white)",
          borderTop: "1.5px solid oklch(0.89 0.006 62)",
          borderBottom: "1.5px solid oklch(0.89 0.006 62)",
          gap: 4,
          padding: "0 14px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ marginRight: 10, flexShrink: 0 }}>
          {logoSlot ?? <LogoMark />}
        </div>

        {/* Board menu */}
        <BoardMenu menuItemFactory={menuItemFactory} />

        <TbSeparator />

        {children ? children : null}

        {statusSlot && <CentredStatus>{statusSlot}</CentredStatus>}

        {/* Right side */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {actionsSlot}
          <ShareMenu />
          <TbSeparator />
          <AccountAvatar />
          {menuSlot ?? (!hideNavigation && <AppMenu />)}
        </div>
      </div>
    );
  }

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
      className={
        isSketch
          ? "select-none w-full"
          : "select-none w-full bg-gradient-to-r from-white from-20% to-zinc-100 to-100% shadow-[0_2px_3px_rgba(0,0,0,0.10)]"
      }
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
          <div className="pr-1.5">{logoSlot ?? <HomeIcon />}</div>

          <BoardMenu menuItemFactory={menuItemFactory} />

          {children ? children : null}

          {statusSlot && <CentredStatus>{statusSlot}</CentredStatus>}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              paddingRight: 6,
            }}
          >
            <AccountAvatar />
          </div>
          {menuSlot ?? (!hideNavigation && <AppMenu />)}
        </div>
      </div>
    </div>
  );
}
