import { CSSProperties } from "react";

import Text from "hkp-frontend/src/ui-components/Text";

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
    <div style={itemStyle}>
      {
        <div
          style={{
            paddingTop: 9,
            marginLeft: 10,
            minWidth: 150,
          }}
        >
          <h2 className="text-sky-600">{item.title}</h2>
        </div>
      }
      <div className="ml-[10px] mt-2">
        <>
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
        </>
      </div>
    </div>
  );
}
