import { useNavigate } from "react-router-dom";
import Button from "@/ui-components/Button";

export default function BackgroundSection() {
  const navigate = useNavigate();

  return (
    <div className="flex gap-0.5 mx-auto mt-1 w-[80%] mb-10">
      <Button className="w-full" onClick={() => navigate("/welcome/mission")}>
        What is this?
      </Button>

      <Button className="w-full" onClick={() => navigate("/engage")}>
        I want to engage
      </Button>
    </div>
  );
}
