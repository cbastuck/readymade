import { Dropdown } from "semantic-ui-react";
import { Link } from "react-router-dom";
import { BoardContextState } from "../../BoardContext";

type Props = {
  board?: string;
  boardContext: BoardContextState;
  boardSyncActive: boolean;
};

export default function BoardMenu({
  board,
  boardContext,
  boardSyncActive,
}: Props) {
  const menuItemStyle: any = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  };

  return (
    <Dropdown
      id="board-dropdown"
      text={board || "Board"}
      className="link item"
      style={{
        fontSize: 11,
        letterSpacing: 1,
        textTransform: "uppercase",
        paddingLeft: 5,
        paddingRight: 8,
      }}
    >
      <Dropdown.Menu>
        <Dropdown.Item
          onClick={() =>
            boardContext.onAction({
              type: "newBoard",
            })
          }
        >
          <span style={menuItemStyle}>New Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext.onAction({
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
            boardContext.onAction({
              type: "shareBoard",
            })
          }
          disabled={
            !boardContext ||
            !boardContext.isActionAvailable({ type: "shareBoard" })
          }
        >
          <span style={menuItemStyle}>Share Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext.onAction({
              type: "saveBoard",
            })
          }
          disabled={
            !boardContext ||
            !boardContext.isActionAvailable({ type: "saveBoard" })
          }
        >
          <span style={menuItemStyle}>Save Board</span>
        </Dropdown.Item>
        <Dropdown.Item
          onClick={() =>
            boardContext.onAction({
              type: "toggleBoardSync",
            })
          }
          disabled={
            !boardContext ||
            !boardContext.isActionAvailable({ type: "toggleBoardSync" })
          }
        >
          <span style={menuItemStyle}>
            {boardSyncActive ? "Disable Sync" : "Board Sync"}
          </span>
        </Dropdown.Item>
        <Dropdown.Item>
          <Link to={`${window.location.pathname}/src`}>
            <span style={menuItemStyle}>Board Source</span>
          </Link>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
