import { Copyright as CopyrightIcon } from "lucide-react";

type Props = {
  isWide: boolean;
};

export default function Copyright({ isWide }: Props) {
  return (
    <div
      className="font-sans-clean flex text-sm items-center"
      style={{
        marginLeft: "auto",
        marginRight: 10,
      }}
    >
      <CopyrightIcon className="px-1" size="18px" />
      <span>
        {isWide ? (
          <>
            <a
              href="https://bstck.berlin"
              target="_blank"
              style={{ fontSize: 9 }}
            >
              BSTCK BRLN
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
