import Text from "hkp-frontend/src/ui-components/Text";
import { CSSProperties } from "react";

type Props = {
  children: JSX.Element | string | Array<JSX.Element | string>;
  width?: string;
  headline?: string;
  style?: CSSProperties;
};

export default function Paragraph({ width, headline, children, style }: Props) {
  return (
    <div
      style={{
        width: width || undefined,
        margin: width ? "auto" : undefined,
        ...style,
      }}
    >
      {headline && <h2>{headline}</h2>}
      <Text className="mt-[20px]">{children}</Text>
    </div>
  );
}
