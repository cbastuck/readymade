import Info from "hkp-frontend/src/components/Info";
import { createDescription } from "./factory";
import { BaseType } from "./types";

type Props = {
  description?: string | BaseType | Array<BaseType>;
  boardName: string;
};

export default function Description({ description, boardName }: Props) {
  if (!description) {
    return false;
  }
  const arr = Array.isArray(description) ? description : [description];
  return (
    <div className="py-2 my-4 mx-0 border bg-white">
      <Info headline="Description">
        <div className="w-[90%] mx-auto my-[10px]">
          {arr.map((item, idx) => createDescription({ boardName, item, idx }))}
        </div>
      </Info>
    </div>
  );
}
