import { ReactNode, useContext, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { CommandList } from "cmdk";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "hkp-frontend/src/ui-components/primitives/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "hkp-frontend/src/ui-components/primitives/popover";
import { ThemeCtx } from "hkp-frontend/src/ui-components/ThemeContext";
import GroupLabel from "./GroupLabel";

type Props = {
  title: string | ReactNode;
  label?: string;
  searchPlaceholder?: string;
  value: string;
  options: Array<string>;
  className?: string;
  children?: React.ReactNode;
  onSelect: (value: string) => void;
};

export default function SearchableSelect({
  title,
  label = "Select",
  searchPlaceholder = "Search",
  value,
  options,
  className,
  children,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const theme = useContext(ThemeCtx);
  return (
    <div className="flex w-full items-center gap-2 justify-left">
      <GroupLabel>{title}</GroupLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`justify-between text-base ${className}`}
            style={{
              backgroundColor: theme.popoverBackgroundColor,
              borderColor: theme.borderColor,
            }}
          >
            {value || label}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`p-0 h-[260px] opacity-100 font-menu ${className}`}
        >
          <Command style={{ borderRadius: theme.borderRadius }}>
            <CommandInput
              className="text-base"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandEmpty className="text-base p-2">
              No service found
            </CommandEmpty>
            <CommandList className="overflow-auto">
              {options.map((s, idx) => (
                <CommandItem
                  className="text-base"
                  key={idx}
                  value={s}
                  onSelect={onSelect}
                  disabled={false}
                >
                  {s}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {children}
    </div>
  );
}
