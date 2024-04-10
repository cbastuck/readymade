import { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "semantic-ui-react";

type NavButtonProps = {
  to: string;
  label: string;
  style?: CSSProperties;
};

export default function TemplateButton({
  to,
  label,
  style: styleOverride = {},
}: NavButtonProps) {
  const navigate = useNavigate();
  const style = {
    fontSize: 14,
    border: "1px solid darkgray",
    color: "white",
    backgroundColor: "#454f6d",
    width: "100%",
    whiteSpace: "nowrap",
    ...styleOverride,
  };
  return (
    <div style={{ textAlign: "center", width: "100%", margin: "10px 0px" }}>
      <Button className="" style={style} onClick={() => navigate(to)}>
        {label ? label : "Next"}
      </Button>
    </div>
  );
}
