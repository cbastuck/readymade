import { forwardRef, useMemo } from "react";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";
import { flatten } from "flat";
import { TooltipContentType } from "hkp-frontend/src/ui-components/Tooltip";

type Props = {
  id?: string;
  className?: string;
  value: string;
  autoCompleteValueSuggestions?: Array<string>;
  selectAllOnFocus?: boolean;
  tooltip?: TooltipContentType;
  isExpandable?: boolean;
  showBackground?: boolean;
  onSubmit: (newValue: string) => void;
  onTab: (curValue: string) => void;
  onChangePending: (isChangePending: boolean) => void;
};

const AutocompleteInputField = forwardRef<HTMLInputElement, Props>(
  (props, ref) => {
    const {
      id,
      className,
      value,
      autoCompleteValueSuggestions,
      tooltip,
      selectAllOnFocus = true,
      isExpandable = false,
      showBackground = false,
      onSubmit,
      onTab,
      onChangePending,
    } = props;
    const autoCompleteValues = useMemo(() => {
      if (typeof autoCompleteValueSuggestions === "object") {
        const keys = Object.keys(flatten(autoCompleteValueSuggestions));
        if (keys.length > 0) {
          return keys;
        }
      }
    }, [autoCompleteValueSuggestions]);

    return (
      <SubmittableInput
        ref={ref}
        id={id}
        className={className}
        autoCompleteValues={autoCompleteValues}
        value={value}
        selectAllOnFocus={selectAllOnFocus}
        tooltip={tooltip}
        fullWidth
        hideBottomBorder
        isExpandable={isExpandable}
        showBackground={showBackground}
        onSubmit={onSubmit}
        onChangePending={onChangePending}
        onTab={onTab}
      />
    );
  }
);

export default AutocompleteInputField;
