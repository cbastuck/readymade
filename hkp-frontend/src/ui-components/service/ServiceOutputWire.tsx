import { GitCommitHorizontal } from "lucide-react";

import { useTheme } from "../ThemeContext";

type Props = { isActive?: boolean };
export default function ServiceOutputWire({ isActive }: Props) {
  const theme = useTheme();

  return (
    <div
      style={{
        position: "absolute",
        top: "50px",
        marginLeft: "99.8%",
        cursor: "pointer",
      }}
    >
      <GitCommitHorizontal
        stroke={isActive ? "darkgray" : theme.borderColor}
        fill={isActive ? theme.accentColor : theme.backgroundColor}
        strokeWidth={isActive ? 0.8 : 1}
      />
    </div>
  );
}
