import { Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

type Props = {
  destination?: string;
  text: string;
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
  const onClick =
    onClicked ||
    (destination
      ? () => navigate(destination)
      : () => {
          console.error("NavigationButton no destination or onClick handler");
        });
  return (
    <Button
      onClick={onClick}
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
    >
      {text}
    </Button>
  );
}
