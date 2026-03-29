import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";

import { withRouter } from "../common";
import { useAppContext } from "../AppContext";
import { redirectUri } from "../core/actions";
import { popItem } from "../core/storage";
import LoginCheckMail from "./LoginCheckMails";

type AuthRedirectProps = {
  location: {
    search: string;
  };
  [key: string]: any;
};

function AuthRedirect(props: AuthRedirectProps) {
  const appContext = useAppContext();
  const queryParamsRef = useRef<Record<string, string> | undefined>(undefined);

  // Initialize queryParams once on mount (mirrors constructor logic)
  if (queryParamsRef.current === undefined) {
    if (window.parent !== window) {
      // TODO: we should not do this here
      window.parent.location.href = window.location.href;
    } else {
      const { location } = props;
      queryParamsRef.current = Object.fromEntries(
        new URLSearchParams(location.search.substr(1))
      );
    }
  }

  const queryParams = queryParamsRef.current;

  // Determine initial step from query params
  const getInitialStep = () => {
    if (!queryParams) return "init";
    if (queryParams.step !== undefined) return queryParams.step;
    return "init";
  };

  const [tokenUpdated, setTokenUpdated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [step] = useState<string>(getInitialStep);

  const exchangeCodeForToken = async (code: string): Promise<void> => {
    const clientId = "hookup";
    const pkceVerifier = popItem("pkce_verifier");
    const response = await fetch("/openid/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: "hkp",
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code,
        code_verifier: pkceVerifier ?? "",
      }).toString(),
    });

    const result = await response.json();
    if (result && result.id_token) {
      setToken(result.id_token);
    }
  };

  useEffect(() => {
    if (queryParams?.code) {
      exchangeCodeForToken(queryParams.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!queryParams) {
    return false;
  }

  if (queryParams.error) {
    return (
      <Navigate
        to="/loginFail"
        state={{ errorMessage: queryParams.error }}
      />
    );
  }

  if (step === "mailsent") {
    return <LoginCheckMail />;
  }

  if (!token) {
    return false;
  }

  if (!tokenUpdated) {
    (appContext as any)
      .updateToken(token)
      .then(() => setTokenUpdated(true));
    return false;
  }

  return queryParams!.state ? (
    <Navigate to={`/${queryParams!.state}`} />
  ) : (
    <Navigate to="/" />
  );
}

export default withRouter(AuthRedirect);
