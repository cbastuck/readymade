import { forwardRef, useEffect, useState } from "react";
import SubmittableInput from "@/ui-components/SubmittableInput";
import { flatten } from "flat";

type Props = {
  id?: string;
  value: string;
  autoCompleteValueSuggestions?: Array<string>;
  selectAllOnFocus?: boolean;
  showCompletionsOnTab?: boolean;
  onSubmit: (newValue: string) => void;
  onTab: (curValue: string) => void;
  onChangePending: (isChangePending: boolean) => void;
};

const AutoInputField = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    id,
    value,
    autoCompleteValueSuggestions,
    selectAllOnFocus = true,
    showCompletionsOnTab = false,
    onSubmit,
    onTab,
    onChangePending,
  } = props;
  const [autoCompleteValues, setAutoCompleteValues] = useState<
    Array<string> | undefined
  >(undefined);

  const computeAutoCompleteValues = (data: any) => {
    if (typeof data === "object") {
      const keys = Object.keys(flatten(data));
      if (keys.length > 0) {
        setAutoCompleteValues(keys);
        // trigger the autocomplete menu
        setTimeout(() => id && document.getElementById(id)?.click(), 100);
      }
    }
  };

  useEffect(() => {
    computeAutoCompleteValues(autoCompleteValueSuggestions);
  }, [autoCompleteValueSuggestions]);

  const onTabInternal = (newValue: string) => {
    if (showCompletionsOnTab) {
      if (autoCompleteValueSuggestions) {
        computeAutoCompleteValues(autoCompleteValueSuggestions);
      } else {
        onTab(newValue);
      }
    } else {
      onTab(newValue);
    }
  };

  return (
    <SubmittableInput
      ref={ref}
      id={id}
      autoCompleteValues={autoCompleteValues}
      value={value}
      selectAllOnFocus={selectAllOnFocus}
      fullWidth
      hideBottomBorder
      onSubmit={onSubmit}
      onChangePending={onChangePending}
      onTab={onTabInternal}
    />
  );
});

export default AutoInputField;
