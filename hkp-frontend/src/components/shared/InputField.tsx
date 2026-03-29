import { CSSProperties, useEffect, useState } from "react";

import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

import { s, t } from "../../styles";

type InputValueType = string | undefined;

type InputFieldType = "text" | "password";

export type Props = {
  value: InputValueType;
  label: string;
  type?: InputFieldType | undefined;
  synced?: boolean;
  disabled?: boolean;
  unit?: string;
  labelStyle?: CSSProperties;
  style?: CSSProperties;
  isExpandable?: boolean;
  className?: string;

  onChange?: (value: string) => void;
  onEscape?: (value: string) => void;
  onFocus?: () => void;
  onLabelClicked?: () => void;
};

export default function InputField({
  value: propValue,
  label,
  type = "text",
  synced = true,
  disabled,
  unit,
  labelStyle: _labelStyle,
  style,
  isExpandable = false,
  className = "",
  onChange = () => {},
  onEscape: _onEscape,
  onFocus: _onFocus,
  onLabelClicked: _onLabelClicked,
}: Props) {
  const [value, setValue] = useState<InputValueType>("");

  useEffect(() => {
    if (synced) {
      setValue(propValue);
    }
  }, [propValue, synced]);

  const resolvedValue = synced ? value : propValue;

  const renderInputType = (
    val: InputValueType,
    inputType: InputFieldType,
    lbl: string
  ) => {
    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        <SubmittableInput
          title={lbl}
          type={inputType}
          value={val === undefined ? "" : val}
          onSubmit={onChange}
          disabled={disabled}
          className={`my-0 ${className} font-menu`}
          fullWidth
          minHeight={false}
          isExpandable={isExpandable}
        />
        {unit && (
          <div
            style={s(t.ls1, t.fs12, {
              marginLeft: 5,
              marginTop: 6,
              textAlign: "left",
            })}
          >
            {unit}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "row",
        margin: "3px 0px",
        ...style,
      }}
    >
      {renderInputType(resolvedValue, type, label)}
    </div>
  );
}
