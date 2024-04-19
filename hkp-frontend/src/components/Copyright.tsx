import build from "../buildNumber.json";
import { Copyright as CopyrightIcon } from "lucide-react";

type Props = {
  isWide: boolean;
};

export default function Copyright({ isWide }: Props) {
  return (
    <div
      className="font-serif-wet flex text-sm"
      style={{
        marginLeft: "auto",
        marginRight: 10,
      }}
    >
      <CopyrightIcon className="px-1" size="14px" />

      <span>{isWide ? "cbastuck 2024" : "2024"}</span>

      <span
        className="px-1"
        style={{
          color: "gray",
          textTransform: "none",
          fontSize: isWide ? undefined : "9px",
        }}
      >
        v{build.version}
      </span>
    </div>
  );
}
