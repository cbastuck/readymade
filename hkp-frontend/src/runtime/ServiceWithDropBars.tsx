import DropTarget from "hkp-frontend/src/components/DropTarget";
import {
  HKP_DND_SERVICE_TYPE,
  isServiceInstanceDrop,
} from "hkp-frontend/src/components/DropTypes";
import { useTheme } from "hkp-frontend/src/ui-components/ThemeContext";

type Props = {
  index: number;
  allowDropBehind: boolean;
  children: JSX.Element;
  onDrop: (svcUuid: string, pos: number) => void;
};

export default function ServiceWithDropBar(props: Props) {
  const { onDrop: onDropProp, index } = props;
  const theme = useTheme();
  const dropTargetStyle = {
    width: 20,
    height: "94%",
    margin: "10px 0px",
    borderRadius: 3,
  };
  const onDrop = (idx: number, data: any) => {
    const dropData = JSON.parse(data);
    if (isServiceInstanceDrop(dropData)) {
      onDropProp?.(dropData.uuid, idx);
    }
  };
  return (
    <div className="flex">
      <DropTarget
        style={dropTargetStyle}
        activeColor={`linear-gradient(to right, #ffffff00 0%, #ffffff00 30%, ${theme.dropBarColor} 50%, #ffffff00 70%)`}
        acceptedType={HKP_DND_SERVICE_TYPE}
        onDrop={(data) => onDrop(index, data)}
      />

      {props.children}
      {props.allowDropBehind && (
        <DropTarget
          style={dropTargetStyle}
          activeColor={`linear-gradient(to right, #ffffff00 0%, #ffffff00 30%, ${theme.dropBarColor} 50%, #ffffff00 70%)`}
          acceptedType={HKP_DND_SERVICE_TYPE}
          onDrop={(data) => onDrop(index + 1, data)}
        />
      )}
    </div>
  );
}
