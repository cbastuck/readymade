import { ReactElement } from "react";

import Card, { Action } from "./Card";
import { SavedBoard, UsecaseDescriptor } from "../../types";

type Props = {
  filter: string;
  items: Array<UsecaseDescriptor> | Array<SavedBoard>;
  actions?: Array<{ name: string; icon: ReactElement }>;
  onAction?: (action: Action, item: UsecaseDescriptor | SavedBoard) => void;
  height?: string | number;
};

export default function Collection({
  items,
  filter,
  actions,
  onAction,
  height = "100%",
}: Props) {
  return (
    <div
      className={`flex flex-wrap w-full overflow-y-auto overflow-x-hidden h-[${height}]`}
    >
      {items
        .filter((x) => !filter || x.name.toLowerCase().indexOf(filter) !== -1)
        .map((x) => (
          <Card key={x.name} value={x} actions={actions} onAction={onAction} />
        ))}
    </div>
  );
}
