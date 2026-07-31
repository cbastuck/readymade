import { Auth0Provider } from "@auth0/auth0-react";

type Props = {
  children: any;
  domain?: string;
  clientId?: string;
  redirectUri?: string;
};

export default function AuthProvider({
  children,
  domain = "hookitapp.eu.auth0.com",
  clientId = "gpk8IFPKfaOTQUzpDRO7vBajOnB72rkM",
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
