import React, { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { cn } from "hkp-frontend/src/ui-components";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  autoCompleteValues?: Array<string>;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, autoCompleteValues, ...props }, ref) => {
    const autoCompleteId = useMemo(
      () => (autoCompleteValues ? uuidv4() : undefined),
      [autoCompleteValues]
    );
    return (
      <>
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          list={autoCompleteId}
          {...props}
        />
        {autoCompleteId && autoCompleteValues && (
          <datalist id={autoCompleteId}>
            {autoCompleteValues.map((option) => (
              <option key={`autoCompleteValue-${option}`}>{option}</option>
            ))}
          </datalist>
        )}
      </>
    );
  }
);
Input.displayName = "Input";

export { Input };
