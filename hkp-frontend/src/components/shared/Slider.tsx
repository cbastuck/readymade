import { useState } from "react";
import SyncIndicator from "./SyncIndicator";

type OnChangeEvent =
  | React.MouseEvent
  | React.KeyboardEvent
  | React.ChangeEvent<HTMLTextAreaElement>;
type OnChangeValue = { value: number };
type Props = {
  value: number;
  label: string;
  synced?: boolean;
  minValue: number;
  maxValue: number;
  labelStyle?: any;
  style?: any;

  onLabelClicked?: (ev: OnChangeEvent, value: OnChangeValue) => void;
  onChange: (ev: OnChangeEvent, value: OnChangeValue) => void;
};

export default function Slider({
  value: syncedValue,
  label,
  minValue,
  maxValue,
  onChange,
  onLabelClicked = () => {},
  synced = true,
  labelStyle = {},
  style = {},
}: Props) {
  const [stateValue, setStateValue] = useState<number>(syncedValue);

  const fontSize = 11;
  const value = synced ? stateValue : syncedValue;
  const inSync = synced ? value === syncedValue : true;
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        margin: "3px 0px",
        minWidth: "350px",
      }}
    >
      <div style={{ width: "100%", textAlign: "left" }}>
        <SyncIndicator
          onClick={(ev) =>
            inSync ? onLabelClicked(ev, { value }) : onChange(ev, { value })
          }
          inSync={synced ? inSync : true}
          label={`${label}: ${stateValue}`}
          style={{
            ...labelStyle,
            fontSize,
            width: "100%",
            textAlign: "left",
          }}
        />
      </div>
      <input
        type="range"
        min={minValue * 100}
        max={maxValue * 100}
        value={stateValue * 100}
        onChange={(ev) => setStateValue(Number(ev.target.value) / 100)}
        onMouseUp={(ev: any) => onChange(ev, { value: ev.target.value / 100 })}
        style={{ accentColor: "#4183c4" }}
      />
    </div>
  );
}
