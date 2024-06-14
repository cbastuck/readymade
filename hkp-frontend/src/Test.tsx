import { BrowserRouter as Router } from "react-router-dom";
import AuthProvider from "./auth/Auth0Provider";
import AppProvider from "./AppContext";
import Playground from "./views/playground";
import Notifications from "./Notifications";

import "./index.css";
import "../app/globals.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <Playground boardName="test" />
          <Notifications />
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
