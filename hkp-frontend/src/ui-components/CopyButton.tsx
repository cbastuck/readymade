import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Button from "hkp-frontend/src/ui-components/Button";
import { copyToClipboard } from "hkp-frontend/src/clipboard";

type Props = {
  /** Text placed on the clipboard. */
  value: string;
  /** Names the value in the tooltip and the confirmation. */
  label?: string;
  className?: string;
  size?: number;
};

/**
 * Copies a value that is shown but not typed — an address a runtime assigned,
 * an id — so it can be taken without selecting the text by hand, which touch
 * input makes awkward.
 */
export default function CopyButton({
  value,
  label = "Value",
  className = "",
  size = 14,
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const onCopy = async () => {
    if (!(await copyToClipboard(value))) {
      return;
    }
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Button
      className={`h-min w-min ${className}`}
      variant="ghost"
      title={`Copy ${label.toLowerCase()}`}
      icon={copied ? <Check size={size} /> : <Copy size={size} />}
      onClick={onCopy}
      disabled={!value}
    />
  );
}
