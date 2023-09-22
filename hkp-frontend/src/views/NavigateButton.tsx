import { Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

type Props = {
  text: string;
  destination?: string;
  width?: number | string;
  onClicked?: () => void;
};
export default function NavigateButton({
  destination,
  text,
  width,
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
      style={{
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 2,
        whiteSpace: "nowrap",
        border: "solid 1px white",
        color: "black",
        padding: 10,
        width: width ? width : "initial",
      }}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}
