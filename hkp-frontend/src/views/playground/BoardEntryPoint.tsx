import { useState } from "react";
import { Link } from "react-router-dom";

import { BoardContextState } from "../../BoardContext";
import { narrowBoardContext } from "../../facade/boardServices";
import EmptyBoard from "./EmptyBoard";
import { s, t } from "../../styles";

import VSpacer from "../../components/shared/VSpacer";
import Board from "./Board";

import LoadIndicator from "./LoadIndicator";
import FacadeRenderer from "../../facade/FacadeRenderer";
import { useFacadeView } from "../../facade/FacadeViewContext";

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
  const boardName = boardContext.boardName || requestedBoardName || "";

  // Units are not merged into one surface: each contributes a view, and the
  // board is looked at through one of them at a time. A board that is not a
  // composition has the single facade it always had.
  const views = boardContext.linkage?.views ?? [];
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  // The tabs switch between facades, so they belong to the facade half and go
  // with it. The choice is kept rather than reset: the tab comes back on the
  // view it was left on.
  const facadeView = useFacadeView();
  const activeView =
    views.find((view) => view.id === activeViewId) ?? views[0] ?? null;
  const facade = activeView?.facade ?? boardContext.facade;
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
        {views.length > 1 && facadeView?.showFacade !== false && (
          <div
            role="tablist"
            style={{
              display: "flex",
              gap: 4,
              padding: "6px 8px 0",
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {views.map((view) => (
              <button
                key={view.id}
                role="tab"
                aria-selected={view.id === activeView?.id}
                className="hkp-view-tab"
                onClick={() => setActiveViewId(view.id)}
              >
                {view.title}
              </button>
            ))}
          </div>
        )}
        <FacadeRenderer
          // A different view is a different surface: remounting lets it build
          // its own facade state and run its own `facade.init`, which are keyed
          // to the board name and would otherwise be inherited from whichever
          // view was shown first.
          key={activeView?.id ?? "facade"}
          facade={facade}
          // A unit's view searches that unit's runtimes, so two units may use
          // the same service uuid without their widgets finding each other's.
          boardContext={narrowBoardContext(
            boardContext,
            activeView?.runtimeIds ?? [],
          )}
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
