import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { redirectUri } from "../core/actions";
import { s, t } from "../styles";

import { restoreItem, storeItem } from "../core/storage";
import { createChallengeAndVerifier } from "../core/pkce";

type Props = {
  board: string;
};

export default function Login(props: Props) {
  const { board } = props;
  const [pkceChallenge, setPkceChallenge] = useState<string | undefined>(undefined);
  const [pkceVerifier, setPkceVerifier] = useState<string | undefined>(undefined);

  useEffect(() => {
    generatePkceChallenge();
  }, []);

  async function generatePkceChallenge() {
    if (pkceChallenge) {
      return;
    }

    const { challenge, verifier } = await createChallengeAndVerifier();
    setPkceChallenge(challenge);
    setPkceVerifier(verifier);
  }

  function renderOpenIdLogin(challenge: string, verifier: string) {
    const query = new URLSearchParams({
      code_challenge: challenge,
      code_challenge_method: "S256",
      client_id: "hookup",
      response_type: "code",
      scope: "openid profile permissions features email",
      redirect_uri: redirectUri(),
      state: board || "",
    }).toString();
    storeItem("pkce_verifier", verifier);
    return (
      <div
        style={{
          height: "100%",
          width: "100%",
          paddingTop: "5%",
        }}
      >
        <iframe
          title="login-frame"
          src={`/openid/auth?${query}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </div>
    );
  }

  function renderPlaceholder() {
    return (
      <div
        style={s(
          t.h100,
          t.fs12,
          t.uc,
          t.ls1,
          { paddingTop: "5%", width: "50%", margin: "auto" },
          { textAlign: "justify", textJustify: "inter-word" }
        )}
      >
        <div>User accounts are not publicly supported yet.</div>
        <div>Still in the making, to build something round and sound</div>
        <div style={t.mt10}>
          Please use <Link to="/playground">Playground</Link> for now ...
        </div>
      </div>
    );
  }

  const loginEnabled = restoreItem("__allowlogin");
  if (!loginEnabled) {
    return renderPlaceholder();
  }

  if (!pkceChallenge || !pkceVerifier) {
    return false;
  }

  return renderOpenIdLogin(pkceChallenge, pkceVerifier);
}
