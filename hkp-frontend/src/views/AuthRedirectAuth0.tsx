import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader } from "semantic-ui-react";

export default function AuthRedirectAuth0() {
  const { getIdTokenClaims } = useAuth0();
  const [receivedToken, setReceivedToken] = useState<boolean>(false);

  const resolveToken = async () => {
    const claims = await getIdTokenClaims();
    if (claims?.__raw) {
      setReceivedToken(true);
    }
  };

  if (!receivedToken) {
    resolveToken();
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          textAlign: "center",
          marginTop: "15%",
        }}
      >
        <Loader active inline>
          Logging in ...
        </Loader>
      </div>
    );
  }
  /* auth0 framework already puts the right target location into
   * the window without navigating to it. Check appState in AuthEntries.tsx
   */
  return <Navigate to={window.location.pathname} />;
}
