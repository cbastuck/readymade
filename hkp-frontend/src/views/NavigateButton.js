import { Button } from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

export default function NavigateButton({ destination, text, width }) {
  const navigate = useNavigate();
  return (
    <Button
      onClick={() => navigate(destination)}
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
