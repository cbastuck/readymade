import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";

import Switcher from "../../components/Switcher";

import { useNavigate } from "react-router-dom";
import Button from "@/ui-components/Button";

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
        <div
          className="font-sans"
          style={{ fontSize: "35px", color: "#454f6e", height: "43px" }}
        >
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

      <div className="flex flex-col gap-1 ml-auto mr-auto mt-1 w-[280px]">
        <Button onClick={() => navigate("/welcome/mission")}>
          What is this?
        </Button>

        <Button onClick={() => navigate("/engage")}>I want to engage</Button>
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
    <div className="flex" style={{ marginLeft: "3px", whiteSpace: "nowrap" }}>
      <div className="w-[40px]">{` ${first} `}</div>
      <div
        className="bg-sky-600 rounded"
        style={{
          fontStyle: "normal",
          fontWeight: "bold",
          color: "white",
          paddingLeft: "5px",
          paddingRight: "5px",
          marginRight: "5px",
        }}
      >
        {second}
      </div>
      <div>{` ${third} `}</div>
    </div>
  );
}
