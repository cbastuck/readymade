import { useContext, useRef } from "react";
import { Copy } from "lucide-react";

import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import Input from "hkp-frontend/src/ui-components/Input";
import { AppCtx } from "hkp-frontend/src/AppContext";
import IconButton from "hkp-frontend/src/ui-components/IconButton";

type Props = {
  className?: string;
  label: string;
  value: string;
  renderInput?: boolean;
  isUrl?: boolean;
  disabled?: boolean;
};

export default function Copyable({
  className,
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
    <div className={`w-[100%] ${className}`}>
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
