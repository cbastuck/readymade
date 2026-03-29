import { CSSProperties, useEffect, useState } from "react";

import { Textarea } from "hkp-frontend/src/ui-components/primitives/textarea";

import SyncIndicator from "./SyncIndicator";

type OnChangeEvent =
  | React.MouseEvent
  | React.KeyboardEvent
  | React.ChangeEvent<HTMLTextAreaElement>;
type OnChangeValue = { value: string };

type Props = {
  value: string;
  label: string;
  synced?: boolean;
  disabled?: boolean;
  unit?: string;
  labelStyle?: CSSProperties;
  style?: CSSProperties;
  resizeable?: boolean;

  onChange: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onEscape?: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onFocus?: () => void;
  onLabelClicked?: (ev: OnChangeEvent, value: OnChangeValue) => void;
};

export default function InputText({
  value: propValue,
  label,
  synced = true,
  labelStyle,
  style,
  resizeable = true,
  onChange,
  onLabelClicked = () => {},
}: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (synced) {
      setValue(propValue);
    }
  }, [propValue, synced]);

  const resolvedValue = synced ? value : propValue;
  const inSync = synced ? resolvedValue === propValue : true;
  const fontSize = 11;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        margin: "3px 0px",
        ...style,
        minWidth: "350px",
      }}
    >
      <div style={{ width: "100%", textAlign: "left" }}>
        <SyncIndicator
          onClick={(ev) =>
            inSync ? onLabelClicked(ev, { value: resolvedValue }) : onChange(ev, { value: resolvedValue })
          }
          inSync={synced ? inSync : true}
          label={label}
          style={{
            ...labelStyle,
            letterSpacing: 1,
            fontSize,
            width: "100%",
            textAlign: "left",
          }}
        />
      </div>
      <Textarea
        style={{
          width: "100%",
          fontSize: 14,
          resize: resizeable ? "both" : "none",
          border: "none",
          borderBottom: "1px solid lightgray",
        }}
        value={resolvedValue === undefined ? "" : resolvedValue}
        onChange={(ev) => setValue(ev.target.value)}
        onKeyUp={(ev: React.KeyboardEvent) => {
          switch (ev.key) {
            case "Enter":
              if (ev.ctrlKey && resolvedValue !== "") {
                return onChange(ev, { value: resolvedValue });
              }
              break;
            default:
              break;
          }
        }}
      />
    </div>
  );
}
