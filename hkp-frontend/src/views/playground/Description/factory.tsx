import { s, t } from "../../../styles";

import {
  CheckType,
  HeadlineType,
  BaseType,
  LinkType,
  QRCodeType,
  VSpaceType,
  TextType,
} from "./types";
import Headline from "./Headline";
import Check from "./Check";
import Link from "./Link";
import VSpace from "./VSpace";
import QRCode from "./QRCode";
import Text from "./Text";
import { ReactElement } from "react";

type Props = {
  boardName: string;
  item: string | BaseType | Array<BaseType>;
  idx: string | number;
};

export function createDescription({ boardName, item, idx }: Props) {
  const key = `template-description-item-${idx}`;
  if (typeof item === "string") {
    return (
      <div key={key} style={s(t.fs12, t.tl, t.ls2)}>
        {" "}
        {item}{" "}
      </div>
    );
  }

  if (Array.isArray(item)) {
    return (
      <div key={key} style={{ display: "flex", flexDirection: "row" }}>
        <>
          {item.map((x, y) =>
            createDescription({ boardName, item: x, idx: `${idx}.${y}` })
          )}
        </>
      </div>
    );
  }

  return (
    <div key={key} style={{ padding: "0px 2px", margin: 0, display: "flex" }}>
      {createImpl(item, boardName)}
    </div>
  );
}

function createImpl(item: BaseType, board: string): ReactElement {
  switch (item.type) {
    case "headline":
      return <Headline {...(item as HeadlineType)} />;
    case "check": {
      return <Check {...(item as CheckType)} />;
    }
    case "link": {
      return <Link {...(item as LinkType)} />;
    }
    case "vspace": {
      return <VSpace {...(item as VSpaceType)} />;
    }
    case "qr": {
      return <QRCode {...(item as QRCodeType)} board={board} />;
    }
    case "text":
      return <Text {...(item as TextType)} />;

    default:
      console.error("Unsupported description type", item);
      return <div style={s(t.fs12, t.ls1)}>{JSON.stringify(item)}</div>;
  }
}
