import { useState } from "react";
import { Link } from "react-router-dom";

import Template from "./Template";
import { s, t } from "../styles";
import { redirectTo } from "../core/actions";

export default function LoginCheckMail(): JSX.Element | false {
  const [restartFlow, setRestartFlow] = useState(false);
  if (restartFlow) {
    //removeAuthCookies();
    redirectTo("/login");
    return false;
  }
  return (
    <Template>
      <div
        style={s(t.fs12, t.uc, t.ls1, {
          height: "100%",
          width: "50%",
          margin: "20% auto",
        })}
      >
        <h1 style={t.fs18}>Login link has been sent</h1>
        <div>
          Please check your inbox and click on the link to complete the login.
        </div>
        <div style={{ marginTop: 5 }}>
          If the mail does not arrive, press{" "}
          <Link to="/login">here to resend</Link>
        </div>
        <div>Or start again with a different email address.</div>
        <span
          style={{
            color: "#4586c5",
            cursor: "pointer",
          }}
          onClick={() => setRestartFlow(true)}
        >
          Restart login flow
        </span>
      </div>
    </Template>
  );
}
