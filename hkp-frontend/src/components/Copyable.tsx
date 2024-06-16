import { useContext, useRef } from "react";
import { Copy } from "lucide-react";

import GroupLabel from "@/ui-components/GroupLabel";
import Input from "@/ui-components/Input";
import Button from "@/ui-components/Button";
import { AppCtx } from "@/AppContext";

type Props = {
  label: string;
  value: string;
  renderInput?: boolean;
  isUrl?: boolean;
};

export default function Copyable({
  label,
  value,
  renderInput = true,
  isUrl = true,
}: Props) {
  const input = useRef<HTMLInputElement>(null);

  const appContext = useContext(AppCtx);
  const copyToClipboard = () => {
    const data = renderInput && input.current ? input.current.value : value;
    navigator.clipboard.writeText(data);
    appContext?.pushNotification({
      type: "success",
      message: "Copied to clipboard",
      action: isUrl
        ? {
            label: "open",
            callback: () => window.open(data, "_blank"),
          }
        : undefined,
    });
  };

  return (
    <div className="flex w-full items-center gap-2">
      <GroupLabel>{label}</GroupLabel>
      {renderInput && (
        <Input
          className="font-menu"
          ref={input}
          value={value}
          onChange={() => {}}
          fullWidth
          hideBottomBorder
        />
      )}

      <Button
        className="hover:text-sky-600"
        icon={<Copy />}
        onClick={copyToClipboard}
      />
    </div>
  );
}
