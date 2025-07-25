import { useNavigate } from "react-router-dom";
import Button from "hkp-frontend/src/ui-components/Button";

export default function ExploreHookup() {
  const navigate = useNavigate();
  return (
    <div className="flex gap-0.5 mx-auto mt-1 w-[80%] mb-10">
      <Button className="w-full" onClick={() => navigate("/welcome/mission")}>
        Tell me more!
      </Button>

      <Button className="w-full" onClick={() => navigate("/engage")}>
        Go further down ...
      </Button>
    </div>
  );
}
