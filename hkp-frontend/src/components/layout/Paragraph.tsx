import Text from "@/ui-components/Text";
import { CSSProperties, ReactElement } from "react";

type Props = {
  children: ReactElement;
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
