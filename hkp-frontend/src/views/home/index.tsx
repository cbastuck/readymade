import Template from "../Template";
import LoadPanel from "../../ui-components/boardmanager";

export default function Home() {
  return (
    <Template title="Home" isRoot={true}>
      <div className="flex flex-col h-full">
        <div className="m-auto w-full h-full">
          <LoadPanel />
        </div>
      </div>
    </Template>
  );
}
