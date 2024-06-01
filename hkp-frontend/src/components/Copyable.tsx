import { useContext, useRef } from "react";
import { Copy } from "lucide-react";

import GroupLabel from "@/ui-components/GroupLabel";
import Input from "@/ui-components/Input";
import Button from "@/ui-components/Button";
import { AppCtx } from "@/AppContext";

type Props = {
  label: string;
  value: string;
};

export default function Copyable({ label, value }: Props) {
  const input = useRef<HTMLInputElement>(null);

  const appContext = useContext(AppCtx);
  const copyToClipboard = () => {
    if (input.current) {
      const url = input.current.value;
      navigator.clipboard.writeText(url);
      appContext?.pushNotification({
        type: "success",
        message: "URL copied to clipboard",
        action: {
          label: "open",
          callback: () => window.open(url, "_blank"),
        },
      });
    }
  };

  return (
    <div className="flex w-full items-center gap-2">
      <GroupLabel>{label}</GroupLabel>
      <Input
        className="font-menu"
        ref={input}
        value={value}
        onChange={() => {}}
        fullWidth
        hideBottomBorder
      />
      <Button icon={<Copy />} onClick={copyToClipboard} />
    </div>
  );
}
