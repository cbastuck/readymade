import { BoardContextState } from "../../BoardContext";
import HoverActionIcon from "./HoverActionIcon";

type Props = {
  boardContext: BoardContextState;
};

export default function BoardActions({ boardContext }: Props) {
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
        border: "solid 1px rgba(34,36,38,.15)",
        borderRadius: "5px",
      }}
    >
      <HoverActionIcon
        iconName="save"
        disabled={!isSaveEnabled}
        onClick={onClick}
      />
      <HoverActionIcon
        iconName="code"
        disabled={!isCodeEnabled}
        onClick={onClick}
      />
      <HoverActionIcon
        iconName="share"
        disabled={!isShareEnabled}
        onClick={onClick}
      />
      <span style={{ color: "rgba(34, 36, 38, 0.15)", paddingTop: "6px" }}>
        |
      </span>
      <HoverActionIcon
        iconName="trash"
        dangerous
        disabled={!isClearEnabled}
        onClick={onClick}
      />
    </div>
  );
}
