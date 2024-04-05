import { CSSProperties } from "react";
import { Dropdown } from "semantic-ui-react";
import { useLocation } from "react-router-dom";
import { BoardContextState } from "../../BoardContext";

import "./BoardMenu.css";

type Props = {
  board?: string;
  boardContext: BoardContextState | null;
  boardSyncActive: boolean;
};

export default function BoardMenu({
  board,
  boardContext,
  boardSyncActive,
}: Props) {
  const menuItemStyle: CSSProperties = {
    fontSize: 13,
    letterSpacing: 1.5,
  };

  const location = useLocation();
  return (
    <Dropdown
      id="board-dropdown"
      text={board || "Board"}
      className="link item hkp-fnt-family"
      style={{
        fontSize: 11,
        letterSpacing: 1,

        paddingLeft: 5,
        paddingRight: 8,
      }}
    >
      <Dropdown.Menu>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "newBoard",
            })
          }
        >
          <span style={menuItemStyle}>New Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "clearBoard",
            })
          }
          disabled={
            !boardContext ||
            !boardContext.isActionAvailable({ type: "clearBoard" })
          }
        >
          <span style={menuItemStyle}>Clear Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "shareBoard",
            })
          }
          disabled={
            !boardContext ||
            !boardContext?.isActionAvailable({ type: "shareBoard" })
          }
        >
          <span style={menuItemStyle}>Share Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "saveBoard",
            })
          }
          disabled={
            !boardContext ||
            !boardContext?.isActionAvailable({ type: "saveBoard" })
          }
        >
          <span style={menuItemStyle}>Save Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "toggleBoardSync",
            })
          }
          disabled={
            !boardContext ||
            !boardContext?.isActionAvailable({ type: "toggleBoardSync" })
          }
        >
          <span style={menuItemStyle}>
            {boardSyncActive ? "Disable Sync" : "Board Sync"}
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          disabled={!location.pathname.startsWith("/playground")}
          onClick={() =>
            boardContext?.onAction({
              type: "showBoardSource",
            })
          }
        >
          <span style={menuItemStyle}>Board Source</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext?.onAction({
              type: "createBoardLink",
            })
          }
          disabled={
            !boardContext ||
            !boardContext?.isActionAvailable({ type: "createBoardLink" })
          }
        >
          <span style={menuItemStyle}>Board Link</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
