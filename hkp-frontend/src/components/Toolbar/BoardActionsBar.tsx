import { BoardContextState } from "../../BoardContext";
import HoverActionIcon from "./HoverActionIcon";

type Props = {
  boardContext: BoardContextState;
};

export default function BoardActionsBar({ boardContext }: Props) {
  const onClick = (name: string) => {
    switch (name) {
      case "save":
        return boardContext?.onAction({
          type: "saveBoard",
        });
      case "code":
        return boardContext?.onAction({
          type: "showBoardSource",
        });
      case "share":
        return boardContext?.onAction({
          type: "createBoardLink",
        });
      case "trash":
        return boardContext?.onAction({
          type: "clearBoard",
        });
    }
  };
  const isSaveEnabled = boardContext.isActionAvailable({ type: "saveBoard" });
  const isCodeEnabled = boardContext.isActionAvailable({
    type: "showBoardSource",
  });
  const isShareEnabled = boardContext.isActionAvailable({
    type: "createBoardLink",
  });
  const isClearEnabled = boardContext.isActionAvailable({
    type: "clearBoard",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "32.5px",
        margin: "3px",
        marginLeft: "8px",
        border: "solid 1px rgba(34,36,38,.15)",
        borderRadius: "5px",
      }}
    >
      <HoverActionIcon
        tooltip="Save current board"
        iconName="save"
        disabled={!isSaveEnabled}
        onClick={onClick}
      />
      <HoverActionIcon
        tooltip="Show code of current board"
        iconName="code"
        disabled={!isCodeEnabled}
        onClick={onClick}
      />
      <HoverActionIcon
        tooltip="Create share link for current board"
        iconName="share"
        disabled={!isShareEnabled}
        onClick={onClick}
      />
      <span style={{ color: "rgba(34, 36, 38, 0.15)", paddingTop: "6px" }}>
        |
      </span>
      <HoverActionIcon
        tooltip="Clear current board"
        iconName="trash"
        dangerous
        disabled={!isClearEnabled}
        onClick={onClick}
      />
    </div>
  );
}
