import { Link } from "react-router-dom";

import { BoardContextState } from "../../BoardContext";
import EmptyBoard from "./EmptyBoard";
import { s, t } from "../../styles";

import VSpacer from "../../components/shared/VSpacer";
import Board from "./Board";

import LoadIndicator from "./LoadIndicator";
import FacadeRenderer from "../../facade/FacadeRenderer";

type Props = {
  className?: string;
  isLoading: boolean;
  showLoginRequired: boolean;
  boardContext: BoardContextState;
  requestedBoardName?: string;
  description: string;
  onChangeBoardname: (newName: string) => void;
  emptySlot?: React.ReactNode;
};

export default function BoardEntryPoint({
  className,
  isLoading,
  showLoginRequired,
  boardContext,
  requestedBoardName,
  description,
  onChangeBoardname,
  emptySlot,
}: Props) {
  const facade = boardContext.facade;
  const boardName = boardContext.boardName || requestedBoardName || "";
  const isPlaygroundEmpty =
    boardContext && boardContext.runtimes && boardContext.runtimes.length === 0;

  const saveReminder = (
    <div className="hkp-bot">
      <p>
        Remember to{" "}
        <span
          className="hkp-bot-save-link"
          onClick={() => {
            const selector = document.getElementById("board-menu-trigger");
            if (selector) {
              selector.click();
            }
          }}
        >
          save this board
        </span>{" "}
        and continue later from the <Link to="/home">home view</Link>.
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <LoadIndicator
        text={showLoginRequired ? "Login required" : "Loading Playground"}
      />
    );
  }

  if (isPlaygroundEmpty) {
    if (emptySlot) {
      return (
        <div style={t.w100} className={className}>
          {emptySlot}
        </div>
      );
    }
    return (
      <div style={t.w100} className={className}>
        <div style={s(t.fs16, t.ls1, t.tc)}>
          <EmptyBoard
            boardName={boardName}
            onChangeBoardname={onChangeBoardname}
          />
        </div>
        <VSpacer />
      </div>
    );
  }

  const boardContent = (
    <Board
      boardContext={boardContext}
      description={description}
      boardName={boardName}
    />
  );

  if (facade) {
    return (
      <div
        className={className}
        style={{
          // Fill the available height from parent layout.
          flex: 1,
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <FacadeRenderer
          facade={facade}
          boardContext={boardContext}
          boardName={boardName}
          runtimeContent={boardContent}
        />
      </div>
    );
  }

  return (
    <div style={t.w100} className={className}>
      <div style={s(t.fs16, t.ls1, t.tc)}>
        <div>{boardContent}</div>
      </div>
      <VSpacer />
      {saveReminder}
    </div>
  );
}
