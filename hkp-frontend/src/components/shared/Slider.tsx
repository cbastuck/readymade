import { useState, CSSProperties } from "react";
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
  labelStyle?: CSSProperties;
  style?: CSSProperties;

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
        flexDirection: "row",
        margin: "3px 0px",
        minWidth: "350px",
      }}
    >
      <SyncIndicator
        onClick={(ev) =>
          inSync ? onLabelClicked(ev, { value }) : onChange(ev, { value })
        }
        inSync={synced ? inSync : true}
        label={label}
        style={{
          ...labelStyle,
          fontSize,
          textAlign: "left",
        }}
      />
      <div
        style={{
          width: "100%",
          padding: "8px",
        }}
      >
        <input
          type="range"
          min={minValue * 100}
          max={maxValue * 100}
          value={stateValue * 100}
          onChange={(ev) => setStateValue(Number(ev.target.value) / 100)}
          onMouseUp={(ev: any) =>
            onChange(ev, { value: ev.target.value / 100 })
          }
          style={{
            accentColor: "#4183c4",
            width: "100%",
          }}
        />
      </div>
      <div
        style={{
          width: "80px",
          paddingTop: "6px",
          border: "solid 1px lightgray",
        }}
      >
        {stateValue}
      </div>
    </div>
  );
}
