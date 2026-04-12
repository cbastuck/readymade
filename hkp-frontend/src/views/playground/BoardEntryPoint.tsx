import { Link } from "react-router-dom";

import { BoardContextState } from "../../BoardContext";
import EmptyBoard from "./EmptyBoard";
import { s, t } from "../../styles";

import VSpacer from "../../components/shared/VSpacer";
import Board from "./Board";

import LoadIndicator from "./LoadIndicator";

type Props = {
  className?: string;
  isLoading: boolean;
  showLoginRequired: boolean;
  boardContext: BoardContextState;
  boardName: string;
  description: string;
  onChangeBoardname: (newName: string) => void;
};

export default function BoardEntryPoint({
  className,
  isLoading,
  showLoginRequired,
  boardContext,
  boardName,
  description,
  onChangeBoardname,
}: Props) {
  const isPlaygroundEmpty =
    boardContext && boardContext.runtimes && boardContext.runtimes.length === 0;

  const saveReminder = (
    <div style={{ margin: "10px 0px", fontSize: 14 }}>
      Remember to
      <span
        style={{ cursor: "help", color: "#4284C4" }}
        onClick={() => {
          const selector = document.getElementById("board-menu-trigger");
          if (selector) {
            selector.click();
          }
        }}
      >
        {" save this board "}
      </span>
      and continue later from the <Link to="/home">home view</Link>.
    </div>
  );

  if (isLoading) {
    return (
      <LoadIndicator
        text={showLoginRequired ? "Login required" : "Loading Playground"}
      />
    );
  }
  return (
    <div style={t.w100} className={className}>
      <div style={s(t.fs16, t.ls1, t.tc)}>
        <div>
          {isPlaygroundEmpty ? (
            <EmptyBoard
              boardName={boardName}
              onChangeBoardname={onChangeBoardname}
            />
          ) : (
            <Board
              boardContext={boardContext}
              description={description}
              boardName={boardName}
            />
          )}
          {!isPlaygroundEmpty ? saveReminder : false}
        </div>
      </div>
      <VSpacer />
    </div>
  );
}
