import { Auth0Provider } from "@auth0/auth0-react";

type Props = {
  children: any;
  domain?: string;
  clientId?: string;
  redirectUri?: string;
};

export default function AuthProvider({
  children,
  domain = "dev-ziwr7mkwtcnqrsjp.us.auth0.com",
  clientId = "boZq5bft9A8Tyxq3hdugkuqG8RqnyisZ",
  redirectUri = `${location.protocol}//${location.host}/authRedirect`,
}: Props) {
  const disableAuth = location.href.startsWith("http://192.168.");
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
    >
      {children}
    </Auth0Provider>
  );
}
