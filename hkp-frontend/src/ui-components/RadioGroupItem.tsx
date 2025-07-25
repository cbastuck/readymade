import { RadioGroupItem } from "hkp-frontend/src/ui-components/primitives/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./primitives/tooltip";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

type Props = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
  tooltip?: string;
};

export default function RadioGroupItem_(props: Props) {
  const { tooltip, ...rest } = props;
  return tooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <RadioGroupItem {...rest} />
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <RadioGroupItem {...rest} />
  );
}
