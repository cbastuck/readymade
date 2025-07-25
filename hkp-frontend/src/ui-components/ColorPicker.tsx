import { forwardRef, useMemo, useState, useEffect, useRef } from "react";

import { HexColorPicker } from "react-colorful";
import { cn } from "hkp-frontend/src/ui-components";
import type { ButtonProps } from "hkp-frontend/src/ui-components/primitives/button";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import ColorPalette from "./ColorPalette";

interface ColorPickerProps {
  showPaletteOnly?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const ColorPicker = forwardRef<
  HTMLInputElement,
  Omit<ButtonProps, "value" | "onChange" | "onBlur"> & ColorPickerProps
>(
  (
    {
      showPaletteOnly,
      disabled,
      value,
      onChange,
      onBlur,
      name,
      className,
      ...props
    },
    forwardedRef
  ) => {
    const ref = useForwardedRef(forwardedRef);
    const [open, setOpen] = useState(false);

    const parsedValue = useMemo(() => {
      return value || "#FFFFFF";
    }, [value]);

    return (
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild disabled={disabled} onBlur={onBlur}>
          <Button
            {...props}
            className={cn("block", className)}
            name={name}
            onClick={() => {
              setOpen(true);
            }}
            size="icon"
            style={{
              backgroundColor: parsedValue,
            }}
            variant="outline"
          >
            <div />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px]">
          {!showPaletteOnly && (
            <>
              <HexColorPicker
                style={{ width: "100%" }}
                color={parsedValue}
                onChange={onChange}
              />

              <Input
                className="font-menu text-[0.87rem] mt-2"
                maxLength={7}
                onChange={(e) => {
                  onChange(e?.currentTarget?.value);
                }}
                ref={ref}
                value={parsedValue}
              />
            </>
          )}

          <ColorPalette onChange={onChange} />
        </PopoverContent>
      </Popover>
    );
  }
);
ColorPicker.displayName = "ColorPicker";

export { ColorPicker };

function useForwardedRef<T>(ref: React.ForwardedRef<T>) {
  const innerRef = useRef<T>(null);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(innerRef.current);
    } else {
      ref.current = innerRef.current;
    }
  });

  return innerRef;
}
