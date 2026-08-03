import { BrowserRouter as Router } from "react-router-dom";

import AppProvider from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";
import AuthProvider from "./auth/Auth0Provider";
import Notifications from "./Notifications";
import { ThemeProvider, ThemeName } from "./ui-components/ThemeContext";

import "./index.css";
import "../app/globals.css";

type Props = {
  children: React.ReactNode;
  defaultThemeName?: ThemeName;
  /**
   * The Auth0 application this host signs users in through (see AuthProvider).
   * Passed through rather than defaulted here, because which application is
   * right depends on the host and this shell is mounted by several.
   */
  clientId: string;
};

export default function App({ children, defaultThemeName, clientId }: Props) {
  return (
    <Router>
      <AuthProvider clientId={clientId}>
        <AppProvider>
          <ThemeProvider defaultThemeName={defaultThemeName}>
            <div className="h-full w-full">
              {children}
              <Notifications />
            </div>
            <MessageDispatcher />
          </ThemeProvider>
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}
