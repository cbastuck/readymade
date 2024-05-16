import Routes from "./Routes";
import AppProvider from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";
import AuthProvider from "./auth/Auth0Provider";
import Notifications from "./Notifications";

export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
