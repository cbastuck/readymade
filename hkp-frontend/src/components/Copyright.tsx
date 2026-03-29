import { Copyright as CopyrightIcon } from "lucide-react";

type Props = {
  isWide: boolean;
};

export default function Copyright({ isWide }: Props) {
  return (
    <div
      className="font-sans-clean flex text-sm"
      style={{
        marginLeft: "auto",
        marginRight: 10,
      }}
    >
      <CopyrightIcon className="px-1" size="18px" />
      <span>
        {isWide ? (
          <>
            <a href="https://cbastuck.de" target="_blank">
              cbastuck
            </a>{" "}
            2026
          </>
        ) : (
          "2026"
        )}
      </span>
    </div>
  );
}
