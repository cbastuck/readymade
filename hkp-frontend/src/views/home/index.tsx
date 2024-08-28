import Template from "../Template";
import BoardManager from "../../ui-components/boardmanager";
import BoardComponent from "./BoardComponent";
import localStorageBoard from "./localStorageRetriever.json";
import { BoardDescriptor, PlaygroundTemplate } from "@/types";
import { useState } from "react";

export default function Home() {
  const [boards, setBoards] = useState<
    {
      name: string;
      source: BoardDescriptor;
    }[]
  >([]);
  const onResult = setBoards;
  const board = localStorageBoard as PlaygroundTemplate;
  console.log("BOARDS", boards);
  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <BoardComponent board={board} hidden onResult={onResult} />
          <>
            {boards.map((b) => (
              <a key={b.name} href={`#?${b.source.description}`}>
                {b.name}
              </a>
            ))}
          </>
          <BoardManager title="Local Boards" />
        </div>
      </div>
    </Template>
  );
}
