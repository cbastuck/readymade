import Logo from "./AnimatedLogoStill.png";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import { DragEvent, useContext, useState } from "react";
import { getDraggedFiles, readFile } from "./common";
import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { isBoardDescriptor } from "hkp-frontend/src/types";

type Props = {
  boardName: string;
  onChangeBoardname: (newName: string) => void;
};

export default function EmptyBoard({ boardName, onChangeBoardname }: Props) {
  const boardContext = useContext(BoardCtx);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const onDragOver = (ev: DragEvent) => {
    setIsDraggingOver(true);
    ev.preventDefault();
  };
  const onDragEnd = () => {
    if (isDraggingOver) {
      setIsDraggingOver(false);
    }
  };
  const onDrop = async (ev: DragEvent) => {
    onDragEnd();
    ev.preventDefault();
    const files = getDraggedFiles(ev);
    if (files.length === 1) {
      const src = await readFile(files[0], true);
      const data = typeof src === "string" && JSON.parse(src);
      if (data && isBoardDescriptor(data)) {
        boardContext?.setBoardState(data);
      }
    } else {
      boardContext?.appContext?.pushNotification({
        type: "error",
        message: "Drag not accepted, one flile allowed",
      });
    }
  };

  const headline = !boardName ? (
    "this is an empty board"
  ) : (
    <div className="w-full text-center flex items-center gap-4 font-sans tracking-wider">
      <div className="w-full text-right">This Board</div>
      <div className="w-[50%]">
        <SubmittableInput
          selectAllOnFocus
          fullWidth
          className="text-[#1e70bf] text-center font-menu text-xl capitalize"
          value={boardName}
          onSubmit={onChangeBoardname}
        />
      </div>
      <div className="w-full text-left">is empty.</div>
    </div>
  );

  return (
    <div
      className="text-center"
      style={{ paddingTop: "10%" }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onDragLeave={onDragEnd}
    >
      <div
        className="border"
        style={{
          padding: "50px 20px",
          width: "90%",
          maxWidth: 800,
          margin: "auto",
          backgroundColor: isDraggingOver ? "#0284c710" : undefined,
        }}
      >
        {headline}
        <div style={{ width: "50%", margin: "10px auto" }}>
          <img
            src={Logo}
            alt="HKP Logo"
            style={{ width: "100%", filter: "grayscale(1) opacity(0.45)" }}
          />
        </div>
        <div>
          <span
            style={{ cursor: "help", color: "#4284C4" }}
            onClick={() => {
              const selector = document.getElementById("runtime-menu-trigger");
              if (selector) {
                selector.focus();
                selector.click();
              }
            }}
          >
            {" Add a Runtime "}
          </span>
          to sketch an Idea, or drop a board file here
        </div>
      </div>
    </div>
  );
}
