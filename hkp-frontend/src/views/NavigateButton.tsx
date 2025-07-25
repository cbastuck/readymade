import Button from "hkp-frontend/src/ui-components/Button";
import { useNavigate } from "react-router-dom";

type Props = {
  text: string;
  destination?: string;
  width?: number | string;
  color?: string;
  onClicked?: () => void;
};
export default function NavigateButton({
  destination,
  text,
  width,
  color,
  onClicked,
}: Props) {
  const navigate = useNavigate();
  const onDestination = () => {
    if (!destination) {
      throw new Error("NavigationButton no destination or onClick handler");
    }
    navigate(destination);
  };
  const onClick = onClicked || onDestination;

  return (
    <Button
      className="text-base tracking-widest "
      style={{ width, backgroundColor: color }}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}
