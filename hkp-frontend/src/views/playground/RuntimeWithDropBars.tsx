import DropTarget from "@/components/DropTarget";
import { HKP_DND_RUNTIME_TYPE } from "@/components/DropTypes";
import { useTheme } from "@/ui-components/ThemeContext";

type Props = {
  index: number;
  children: JSX.Element;
  onDrop: (runtimeId: string, index: number) => void;
};
export default function RuntimeWithDropBar({ children, index, onDrop }: Props) {
  const onDropRuntime = (data: any) => {
    if (data) {
      const rt = JSON.parse(data);
      onDrop && onDrop(rt.id, index);
    }
  };

  const theme = useTheme();

  return (
    <div className="flex flex-col w-full">
      <DropTarget
        className="w-full h-[5px] mt-[-5px]"
        acceptedType={HKP_DND_RUNTIME_TYPE}
        onDrop={onDropRuntime}
        activeColor={theme.dropBarColor}
      />
      {children}
    </div>
  );
}
