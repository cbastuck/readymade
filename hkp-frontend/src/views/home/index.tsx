import Template from "../Template";
import BoardManager from "../../ui-components/boardmanager";

export default function Home() {
  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <BoardManager title="Local Boards" />
        </div>
      </div>
    </Template>
  );
}
