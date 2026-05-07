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
};

export default function App({ children, defaultThemeName }: Props) {
  return (
    <Router>
      <AuthProvider>
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
