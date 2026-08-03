import { Auth0Provider } from "@auth0/auth0-react";

type Props = {
  children: any;
  domain?: string;
  /**
   * The Auth0 application to sign users in through, by client id. Required, and
   * deliberately without a default: hosts need *different* applications and no
   * one of them is a safe fallback for the others. Only a SPA-type application
   * has Allowed Web Origins, without which Auth0 refuses the `web_message`
   * silent-auth iframe; only a Native-type one serves the apps' RFC 8252 flow.
   * A host handed the wrong one still logs people in and then loses their
   * session hours later, far from the cause — so the choice is made where it is
   * known, and the type makes forgetting it a compile error.
   *
   * The client id is also the `aud` of the id_token the host ends up sending, so
   * anything verifying those must accept every application in use (hkp-node and
   * hkp-python `AUTH0_AUDIENCE`, the website's `api/auth.php`, the embedded
   * hkp-rt hosts).
   */
  clientId: string;
  redirectUri?: string;
};

export default function AuthProvider({
  children,
  domain = "hookitapp.eu.auth0.com",
  clientId,
  redirectUri = `${location.protocol}//${location.host}/authRedirect`,
}: Props) {
  const disableAuth =
    location.href.startsWith("http://192.168.") ||
    location.href.startsWith("http://10.0.");
  if (disableAuth) {
    return children;
  }
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
      useCookiesForTransactions={false}
      cacheLocation="localstorage"
      // Renew an aged-out token from a refresh token rather than interrupting
      // the user to sign in again. The alternative the SDK would otherwise use
      // — a silent-auth iframe — depends on third-party cookies and so does not
      // work in Safari, which is where an expired session bites hardest.
      // The SDK adds the offline_access scope itself when this is on.
      useRefreshTokens={true}
      // Still try the iframe if the refresh grant is unavailable: on browsers
      // that allow it that is one more way to stay signed in, and where it is
      // blocked the outcome is the same failure we would have had anyway.
      useRefreshTokensFallback={true}
    >
      {children}
    </Auth0Provider>
  );
}
