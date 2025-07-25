import Button from "hkp-frontend/src/ui-components/Button";
import { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

type NavButtonProps = {
  to: string;
  label: string;
  style?: CSSProperties;
};

export default function TemplateButton({ to, label }: NavButtonProps) {
  const navigate = useNavigate();
  return (
    <div className="w-full mx-1">
      <Button className="w-full py-6" onClick={() => navigate(to)}>
        {label ? label : "Next"}
      </Button>
    </div>
  );
}
