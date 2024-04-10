import Participation from "./Participation";
import { PersonalData } from "./Personals";

type Props = {
  tcAgreed: boolean;
  isVisible: boolean;
  personals: PersonalData;
  setTcAgreed: (checked: boolean) => void;
  setPersonals: (updated: PersonalData) => void;
  onToggleVisibility: () => void;
};
export default function PersonalForm({
  isVisible,
  tcAgreed,
  personals,
  setTcAgreed,
  setPersonals,
  onToggleVisibility,
}: Props) {
  return (
    <>
      <div style={{ margin: "10px 0px" }}>
        <button
          onClick={(ev) => {
            ev.preventDefault();
            onToggleVisibility();
          }}
          className=""
          style={{
            padding: 0,
            backgroundColor: "transparent",
            border: "none",
            color: "rgb(66, 132, 196)",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "12pt",
          }}
        >
          {isVisible
            ? "No, does not look it's for me, remove that block again!"
            : "I would like to engage more"}
        </button>
      </div>
      <div
        style={{
          height: "100%",
          maxHeight: isVisible ? 1000 : 0,
          overflow: "hidden",
          opacity: isVisible ? 1 : 0,
          transition: "max-height 1.5s, opacity 0.3s",
        }}
      >
        <Participation
          tcAgreed={tcAgreed}
          personals={personals}
          onPersonalsChanged={setPersonals}
          onTcChanged={setTcAgreed}
        />
      </div>
    </>
  );
}
