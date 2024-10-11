import { BrowserRouter as Router } from "react-router-dom";

import Routes from "./Routes";
import AppProvider from "./AppContext";
import MessageDispatcher from "./MessageDispatcher";
import AuthProvider from "./auth/Auth0Provider";
import Notifications from "./Notifications";

import "./index.css";
import "../app/globals.css";

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <div className="select-none h-full w-full">
            <Routes />
            <Notifications />
          </div>
          <MessageDispatcher />
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}
