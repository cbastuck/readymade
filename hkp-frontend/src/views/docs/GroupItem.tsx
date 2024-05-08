import { CSSProperties } from "react";
import { Item } from "semantic-ui-react";

import Text from "@/ui-components/Text";

type Props = {
  title: string;
  details: string[];
  image?: string;
  bottomDivider?: boolean;
};

export default function GroupItem(item: Props) {
  const itemStyle: CSSProperties = {
    width: "100%",
    marginBottom: 10,
    padding: 20,
    borderBottom: item.bottomDivider ? "solid 1px lightgray" : "none",
  };
  return (
    <Item style={itemStyle}>
      {
        <Item.Header
          className=""
          style={{
            fontSize: 14,
            letterSpacing: 2,
            paddingTop: 9,
            marginLeft: 10,
            minWidth: 150,
            fontWeight: "thin",
          }}
        >
          <span style={{ cursor: "initial", color: "#4183c4", fontSize: 14 }}>
            {item.title}
          </span>
        </Item.Header>
      }
      <Item.Content style={{ marginLeft: 10 }}>
        <Item.Description>
          {item.details.map((detail, idx) => (
            <Text
              key={`detail-${item.title}-${idx}`}
              style={{
                fontSize: 14,
                cursor: "default",
                letterSpacing: 1,
              }}
              yMargin={0}
            >
              {detail}
            </Text>
          ))}
        </Item.Description>
      </Item.Content>
    </Item>
  );
}
