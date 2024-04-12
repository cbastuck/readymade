import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";

import Switcher from "../../components/Switcher";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function WelcomePanel() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col fade-in" style={{ width: "100%" }}>
      <UpdatesButton />
      <div
        style={{
          display: "flex",
          width: "min-content",
          margin: "auto",
        }}
      >
        <div style={{ fontSize: "35px", color: "#454f6e", height: "43px" }}>
          Welcome
        </div>
        <Switcher
          style={{
            width: "130px",
            textAlign: "left",
            marginTop: "21px",
            paddingLeft: "5px",
          }}
          data={[
            <Claim words={["hook", "it", "up"]} />,
            <Claim words={["make", "it", "yours"]} />,
          ]}
        />
      </div>

      <div className="flex flex-col gap-1 ml-auto mr-auto mt-1">
        <NavigateButton
          text="What is this?"
          destination="/welcome/mission"
          width="280px"
        />

        <Button
          className="w-[280px] border  border-black bg-white text-black hover:bg-[#454f6e] hover:text-white"
          onClick={() => navigate("/engage")}
        >
          I want to engage
        </Button>
      </div>
    </div>
  );
}

type ClaimProps = {
  words: Array<string>;
};

function Claim({ words }: ClaimProps) {
  const [first, second, third] = words;
  return (
    <span style={{ marginLeft: "3px", whiteSpace: "nowrap" }}>
      {` ${first} `}
      <span
        style={{
          fontStyle: "normal",
          fontWeight: "bold",
          backgroundColor: "#454f6e",
          color: "white",
          paddingLeft: "5px",
          paddingRight: "5px",
          paddingTop: "4px",
        }}
      >
        {second}
      </span>
      {` ${third} `}
    </span>
  );
}
