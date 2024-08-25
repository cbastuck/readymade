import Template from "../Template";
import BoardManager from "../../ui-components/boardmanager";
import BoardComponent from "./BoardComponent";
import localStorageBoard from "./localStorageRetriever.json";
import { PlaygroundTemplate } from "@/types";

export default function Home() {
  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <BoardComponent board={localStorageBoard as PlaygroundTemplate} />

          <BoardManager title="Local Boards" />
        </div>
      </div>
    </Template>
  );
}
