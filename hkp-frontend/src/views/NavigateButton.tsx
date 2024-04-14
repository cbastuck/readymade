import { Button } from "@/components/ui/button";
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
      className="bg-accent text-white font-sans tracking-widest text-xl"
      style={{ width, backgroundColor: color }}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}
