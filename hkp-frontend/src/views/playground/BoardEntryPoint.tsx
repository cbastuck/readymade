import { useState } from "react";
import { BoardContextState } from "../../BoardContext";
import EmptySketch from "./EmptySketch";
import { s, t } from "../../styles";
import LoadPanel from "./LoadPanel";
import VSpacer from "../../components/shared/VSpacer";
import {
  PeerInputActivation,
  PeerInputRouting,
  PeerOutputActivation,
  PeerOutputRouting,
  RuntimeDescriptor,
  SidechainRoute,
  SidechainRouting,
} from "../../types";
import Board from "./Board";

import LoadIndicator from "./LoadIndicator";

type Props = {
  isLoading: boolean;
  showLoginRequired: boolean;
  boardContext: BoardContextState;
  boardName: string;
  description: string;
  sidechainRouting: SidechainRouting;
  outputRouting: PeerOutputRouting;
  inputRouting: PeerInputRouting;
  onChangeOutputRouting: (
    runtime: RuntimeDescriptor,
    value: PeerOutputActivation
  ) => void;
  onChangeInputRouting: (
    runtime: RuntimeDescriptor,
    value: PeerInputActivation
  ) => void;
  onChangeSidechainRouting: (
    runtime: RuntimeDescriptor,
    routing: Array<SidechainRoute>
  ) => void;
};

export default function BoardEntryPoint({
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
}: Props) {
  const [enforceLoadPanel, setEnforceLoadPanel] = useState(false);
  const isPlaygroundEmpty =
    boardContext && boardContext.runtimes && boardContext.runtimes.length === 0;

  const saveReminder = (
    <div className="" style={{ margin: "10px 0px", fontSize: 14 }}>
      Remember to
      <span
        style={{ cursor: "help", color: "#4284C4" }}
        onClick={() => {
          const selector = document.getElementById("board-dropdown");
          if (selector) {
            selector.focus();
            selector.click();
          }
        }}
      >
        {" save this board "}
      </span>
      and continue later by{" "}
      <span
        id="load-pane-view"
        style={{
          color: "#4284c4",
          cursor: "pointer",
        }}
        onClick={() => {
          setEnforceLoadPanel(true);
          setTimeout(() =>
            document
              .getElementById("load-pane-view")
              ?.scrollIntoView({ behavior: "smooth" })
          );
        }}
      >
        restoring a local board
      </span>
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
    <div style={t.w100}>
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
              }}
            >
              Welcome to Playground
            </h1>
          )}
          <div>
            {isPlaygroundEmpty ? (
              <EmptySketch boardName={boardName} />
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
          {(isPlaygroundEmpty || enforceLoadPanel) && (
            <div style={{ width: "90%", margin: "auto" }}>
              <LoadPanel />
            </div>
          )}
        </div>
      </div>
      <VSpacer />
    </div>
  );
}
