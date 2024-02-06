import { ReactElement } from "react";

type Props = {
  children: ReactElement | string;
};

export default function Headline({ children }: Props) {
  return (
    <h1
      style={{
        letterSpacing: 4,
        fontSize: 18,
        marginTop: 15,
      }}
    >
      {children}
    </h1>
  );
}
