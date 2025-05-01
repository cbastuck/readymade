import { Link } from "react-router-dom";

import { BoardContextState } from "../../BoardContext";
import EmptyBoard from "./EmptyBoard";
import { s, t } from "../../styles";

import VSpacer from "../../components/shared/VSpacer";
import {
  RuntimeInputRoutings,
  RuntimeOutputRoutings,
  RuntimeDescriptor,
  RuntimeInputOptions,
  RuntimeOutputOptions,
  SidechainRoute,
  SidechainRouting,
} from "../../types";
import Board from "./Board";

import LoadIndicator from "./LoadIndicator";

type Props = {
  className?: string;
  isLoading: boolean;
  showLoginRequired: boolean;
  boardContext: BoardContextState;
  boardName: string;
  description: string;
  sidechainRouting: SidechainRouting;
  outputRouting: RuntimeOutputRoutings;
  inputRouting: RuntimeInputRoutings;
  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeOutputOptions
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: RuntimeInputOptions
  ) => void;
  onChangeSidechainRouting: (
    runtime: RuntimeDescriptor,
    routing: Array<SidechainRoute>
  ) => void;
  onChangeBoardname: (newName: string) => void;
};

export default function BoardEntryPoint({
  className,
  isLoading,
  showLoginRequired,
  boardContext,
  boardName,
  description,
  sidechainRouting,
  outputRouting,
  inputRouting,
  onChangeOutputRouting,
  onChangeInputRouting,
  onChangeSidechainRouting,
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
      <div
        style={{
          width: "99%",
          margin: "auto",
        }}
      >
        <div style={s(t.fs16, t.ls1, t.tc)}>
          {isPlaygroundEmpty && (
            <h1
              style={{
                fontSize: "22px",
                margin: 0,
                marginTop: "5%",
                textAlign: "center",
              }}
            >
              Welcome to the Playground
            </h1>
          )}
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
                sidechainRouting={sidechainRouting}
                outputRouting={outputRouting}
                onChangeOutputRouting={onChangeOutputRouting}
                inputRouting={inputRouting}
                onChangeInputRouting={onChangeInputRouting}
                onChangeSidechainRouting={onChangeSidechainRouting}
              />
            )}
            {!isPlaygroundEmpty ? saveReminder : false}
          </div>
        </div>
      </div>
      <VSpacer />
    </div>
  );
}
