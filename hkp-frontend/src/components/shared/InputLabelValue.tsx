import React, { useEffect, useState } from "react";

import InputField from "../../components/shared/InputField";

import { s, t } from "../../styles";

type Props = {
  value: string;
  label: string;
  labelPosition?: string;
  onCommit: (data: { label: string; value: string }) => void;
  onFocus?: () => void;
};

export default function InputLabelValue({
  value: propValue,
  label: propLabel,
  onCommit,
  onFocus: _onFocus,
}: Props): JSX.Element {
  const [label, setLabel] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string | null | undefined>(null);
  const [renamedLabelBuffer, setRenamedLabelBuffer] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setValue(propValue);
  }, [propValue]);

  useEffect(() => {
    setLabel(propLabel);
  }, [propLabel]);

  const stopLabelEditing = (): void => {
    setEditLabel(null);
    setRenamedLabelBuffer(null);
  };

  const renderEditableLabel = (): JSX.Element => {
    return (
      <input
        style={s(t.fs12, { width: 80 })}
        value={
          renamedLabelBuffer === null ? (editLabel ?? "") : renamedLabelBuffer
        }
        ref={(element) => {
          if (element) element.focus();
        }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setRenamedLabelBuffer(e.target.value)
        }
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          switch (e.key) {
            case "Tab":
            case "Enter":
              onCommit({
                label:
                  renamedLabelBuffer === null
                    ? (editLabel ?? "")
                    : renamedLabelBuffer,
                value: value ?? "",
              });
              break;
            case "Escape":
              break;
            default:
              return; // all other keys don't set any state
          }
          stopLabelEditing();
        }}
        onBlur={stopLabelEditing}
      />
    );
  };

  return (
    <InputField
      type="text"
      label={(editLabel === label ? renderEditableLabel() : label) as string}
      value={value ?? ""}
      onChange={(newValue: string) =>
        onCommit({ label: label ?? "", value: newValue })
      }
      onLabelClicked={() => setEditLabel(label)}
      onFocus={() => setEditLabel(undefined)}
    />
  );
}
