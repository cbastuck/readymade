import { Auth0Provider } from "@auth0/auth0-react";

import Routes from "./Routes";
import AppProvider from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";
import Notifications from "./Notifications";

export default function App() {
  const location = window.location;
  const redirectUri = `${location.protocol}//${location.host}/authRedirect`;
  return (
    <Auth0Provider
      domain="dev-ziwr7mkwtcnqrsjp.us.auth0.com"
      clientId="boZq5bft9A8Tyxq3hdugkuqG8RqnyisZ"
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
      useCookiesForTransactions={false}
      cacheLocation="localstorage"
    >
      <AppProvider>
        <div
          style={{
            height: "100%",
            width: "100%",
            overflow: "auto",
          }}
        >
          <Routes />
          <Notifications />
        </div>

        <MessageDispatcher />
      </AppProvider>
    </Auth0Provider>
  );
}
