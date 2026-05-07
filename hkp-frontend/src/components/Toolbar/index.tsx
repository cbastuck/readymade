import { ReactNode, useContext } from "react";

import {
  useTheme,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";

import HomeIcon from "./HomeIcon";

import AppMenu from "hkp-frontend/src/ui-components/toolbar/AppMenu";

import { BoardMenuItemFactory } from "../../types";

import BoardMenu from "hkp-frontend/src/ui-components/toolbar/BoardMenu";

import { BoardCtx } from "hkp-frontend/src/BoardContext";

import IconH from "hkp-frontend/src/components/Toolbar/assets/hkp-single-dot-h.svg?react";

import "./index.css";

type Props = {
  children?: ReactNode;
  isCompact?: boolean;
  hideNavigation?: boolean;
  includeNavigationLinks?: boolean;
  menuItemFactory?: BoardMenuItemFactory;
  menuSlot?: ReactNode;
  logoSlot?: ReactNode;
};

function LogoMark() {
  return (
    <IconH
      className="stroke-[#333] hover:stroke-sky-600"
      width={24}
      height={24}
    />
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="10.5" cy="2.5" r="1.5" />
      <circle cx="10.5" cy="10.5" r="1.5" />
      <circle cx="2.5" cy="6.5" r="1.5" />
      <line x1="3.9" y1="5.8" x2="9.1" y2="3.2" />
      <line x1="3.9" y1="7.2" x2="9.1" y2="9.8" />
    </svg>
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
}: Props) {
  const theme = useTheme();
  const { themeName } = useThemeControl();
  const isSketch = themeName === "sketch";
  const isPlayground = themeName === "playground";
  const boardContext = useContext(BoardCtx);

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

        {/* Right side */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <button
            type="button"
            title="Share"
            onClick={() => boardContext?.onAction({ type: "createBoardLink" })}
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text, #1a1a1a)",
            }}
          >
            <ShareIcon />
          </button>
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

          {menuSlot ?? (!hideNavigation && <AppMenu />)}
        </div>
      </div>
    </div>
  );
}
