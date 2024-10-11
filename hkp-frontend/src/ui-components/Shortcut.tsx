import { Command } from "lucide-react";

type Props = {
  type: "command";
  char: string;
};
export default function Shortcut({ type, char }: Props) {
  return (
    <div className="inline border bg-gray-200 rounded px-1 mx-1">
      {type === "command" && <Command className="inline" size={16} />}+{char}
    </div>
  );
}
