import { useNavigate } from "react-router-dom";
import { s, t } from "../../styles";

import Logo from "./hkp-dots-braid.svg?react";
import SubmittableInput from "@/ui-components/SubmittableInput";

type Props = {
  boardName: string;
};

export default function EmptySketch({ boardName }: Props) {
  const navigate = useNavigate();
  const headline = !boardName ? (
    "this is an empty board"
  ) : (
    <div className="w-full text-center flex items-end gap-4 font-sans tracking-wider">
      <div className="w-full text-right">This board</div>
      <div className="w-[40%]">
        <SubmittableInput
          selectAllOnFocus
          fullWidth
          className="text-[#1e70bf] text-center font-menu text-xl capitalize"
          value={boardName}
          onSubmit={(newName) => navigate(`/playground/${newName}`)}
        />
      </div>
      <div className="w-full text-left">is empty.</div>
    </div>
  );
  return (
    <div style={s({ margin: headline && "15px 0px" })}>
      {headline && <div style={{ marginTop: 20 }} />}
      <div style={{ padding: headline && "20px 0px" }}>
        <div style={s(t.tc, t.mt0, t.mb30)}>
          <div
            className="hkp-card-border"
            style={{
              padding: "50px 20px",
              width: "90%",
              margin: "auto",
            }}
          >
            {headline}
            <div style={{ width: 200, margin: "10px auto" }}>
              <Logo />
            </div>
            <div>
              <span
                style={{ cursor: "help", color: "#4284C4" }}
                onClick={() => {
                  const selector = document.getElementById(
                    "runtime-menu-trigger"
                  );
                  if (selector) {
                    selector.focus();
                    selector.click();
                  }
                }}
              >
                {" Add a Runtime "}
              </span>
              to sketch an Idea
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
