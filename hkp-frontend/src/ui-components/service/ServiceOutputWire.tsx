import Wire from "@/assets/wire.svg?react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui-components/primitives/popover";

import { useTheme } from "../ThemeContext";
import Copyable from "@/components/Copyable";

type Props = { isActive?: boolean; data: any };

export default function ServiceOutputWire({ isActive, data }: Props) {
  const theme = useTheme();

  const value = JSON.stringify(data, null, 2);
  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "-20px",
        cursor: "pointer",
      }}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button>
            <Wire
              width="20px"
              style={{ paddingLeft: 3 }}
              strokeWidth="7px"
              stroke={isActive ? theme.accentColor : theme.borderColor}
              fill={isActive ? theme.accentColor : "white"}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2 ">
              <h2 className="font-medium leading-none w-full text-left flex items-end">
                <div className="w-full">Data</div>
                <div className="ml-auto h-min w-min">
                  <Copyable
                    renderInput={false}
                    label=""
                    value={value}
                    isUrl={false}
                  />
                </div>
              </h2>
            </div>
            <div className="grid gap-2 border border-solid p-2 font-menu text-base">
              {value}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
