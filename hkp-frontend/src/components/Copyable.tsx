import { useContext, useRef } from "react";
import { Copy } from "lucide-react";

import GroupLabel from "@/ui-components/GroupLabel";
import Input from "@/ui-components/Input";
import { AppCtx } from "@/AppContext";
import IconButton from "@/ui-components/IconButton";

type Props = {
  label: string;
  value: string;
  renderInput?: boolean;
  isUrl?: boolean;
  disabled?: boolean;
};

export default function Copyable({
  label,
  value,
  renderInput = true,
  isUrl = true,
  disabled = false,
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
    <div className="w-[70%]">
      <div className="flex items-end gap-2 w-full">
        <GroupLabel>{label}</GroupLabel>
        {renderInput && (
          <Input
            className="font-menu"
            ref={input}
            value={value}
            onChange={() => {}}
            fullWidth
          />
        )}
        <IconButton
          className="px-2 m-0"
          icon={Copy}
          onClick={copyToClipboard}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
