import Logo from "./AnimatedLogoStill.png";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import { DragEvent, useContext, useState } from "react";
import { getDraggedFiles, readFile } from "./common";
import { BoardCtx } from "hkp-frontend/src/BoardContext";
import { isBoardDescriptor, isRuntimeDescriptorConfig } from "hkp-frontend/src/types";
import { useThemeControl } from "hkp-frontend/src/ui-components/ThemeContext";
import RuntimeMenu from "hkp-frontend/src/ui-components/toolbar/RuntimeMenu";

type Props = {
  boardName: string;
  onChangeBoardname: (newName: string) => void;
};

export default function EmptyBoard({ boardName, onChangeBoardname }: Props) {
  const boardContext = useContext(BoardCtx);
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
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
      } else if (data && isRuntimeDescriptorConfig(data)) {
        const { services: rawServices, ...runtimeDesc } = data;
        boardContext?.setBoardState({
          runtimes: [runtimeDesc],
          services: {
            [data.id]: rawServices.map((svc: any) => ({
              uuid: svc.uuid,
              serviceId: svc.serviceId,
              serviceName: svc.serviceName ?? svc.name ?? svc.serviceId,
              state: svc.state,
            })),
          },
        });
      }
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

  if (isPlayground) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 320,
          gap: 12,
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onDragLeave={onDragEnd}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--text-dim, #9ca3af)",
            fontWeight: 500,
          }}
        >
          No runtimes yet
        </div>
        <div>
          <RuntimeMenu triggerStyle={{ fontSize: 14, padding: "10px 22px" }} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--text-dim, #9ca3af)",
            opacity: 0.7,
          }}
        >
          {isDraggingOver
            ? "Drop to import"
            : "or drop a board or runtime file here"}
        </div>
      </div>
    );
  }

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
