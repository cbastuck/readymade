import UpdatesButton from "./UpdatesButton";
import NavigateButton from "../NavigateButton";

type Props = {
  onNext: () => void;
};

export default function WelcomePage({ onNext }: Props) {
  return (
    <div className="fade-in">
      <h1
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          marginLeft: 25,
        }}
      >
        Welcome
        <UpdatesButton />
      </h1>

      <div className="hero-claim">
        <span className="claim-make-yours">
          make <span className="claim-it"> it</span> yours
        </span>
      </div>
      <NavigateButton text="What is this?" width="180px" onClicked={onNext} />
    </div>
  );
}
