import { Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

type Props = {
  text: string;
  destination?: string;
  width?: number | string;
  style?: object;
  onClicked?: () => void;
};
export default function NavigateButton({
  destination,
  text,
  width,
  style: passedStyle,
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
  const style = passedStyle || {
    fontSize: 13,
    letterSpacing: 2,
    whiteSpace: "nowrap",
    border: "solid 1px white",
    padding: "10px",
    width: width ? width : "initial",
  };

  return (
    <Button className="" style={style} onClick={onClick}>
      {text}
    </Button>
  );
}
