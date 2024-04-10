import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";
import Button from "../../components/shared/Button";
import Switcher from "../../components/Switcher";

type Props = {
  onEngage: () => void;
};

export default function WelcomePanel({ onEngage }: Props) {
  return (
    <div className="fade-in" style={{ width: "100%" }}>
      <UpdatesButton />
      <div
        className=""
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
            marginTop: "18px",
            paddingLeft: "5px",
          }}
          data={[
            <Claim words={["hook", "it", "up"]} />,
            <Claim words={["make", "it", "yours"]} />,
          ]}
        />
      </div>

      <NavigateButton
        text="What is this?"
        destination="/welcome/mission"
        style={{
          width: "280px",
          color: "#454f6e",
          fontSize: 14,
          border: "1px white",
        }}
      />

      <Button
        className="hkp-button-blue"
        style={{
          padding: "7px 20px",
          backgroundColor: "black",
          color: "white",
          width: "280px",
          marginTop: "3px",
          height: "40px",
        }}
        onClick={onEngage}
      >
        I want to engage
      </Button>

      <NavigateButton
        text="to Playground?"
        destination="/playground"
        style={{
          width: "280px",
          color: "#454f6e",
          fontSize: 14,
          border: "1px white",
        }}
      />
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
