import {
  Route,
  Routes as RouterRoutes,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom";

import Playground from "./views/playground/index";

import AuthRedirect from "./views/AuthRedirect";
import AuthRedirectAuth0 from "./views/AuthRedirectAuth0";
import Login from "./views/LoginAuth0";
import Logout from "./views/LogoutAuth0";
import Profile from "./views/profile";
import Remotes from "./views/remotes";
import ServiceRedirect from "./views/ServiceRedirect";
import { generateRandomName } from "./core/board";
import { restoreAvailableRuntimeEngines } from "./common";
import { replacePlaceholders } from "./core/url";

export default function Routes(): JSX.Element {
  return (
    <RouterRoutes>
      <Route path="/" element={<Navigate replace to="/playground" />} />
      <Route path="/playground/:board" element={<Playground />} />
      <Route path="/playground" element={<PlaygroundRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/auth2app" element={<AuthRedirect />} />
      <Route path="/authRedirect" element={<AuthRedirectAuth0 />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/serviceRedirect" element={<ServiceRedirect />} />
      <Route path="/remotes" element={<RemotesRoute />} />
      <Route path="/remotes/:remote" element={<RemotesRoute />} />
      <Route path="/remotes/:remote/:runtimeId" element={<RemotesRoute />} />
      {/* This app has no start page, and cloud boards are reached from one —
          so it hosts no cloud view, and anything aimed at one lands here. */}
      <Route path="*" element={<Navigate replace to="/playground" />} />
    </RouterRoutes>
  );
}

/** This app keeps its remotes in localStorage; other hosts have their own store
 *  and pass their own list. */
function RemotesRoute(): JSX.Element {
  const { remote, runtimeId } = useParams();
  return (
    <Remotes
      remotes={restoreAvailableRuntimeEngines() || []}
      remoteName={remote}
      runtimeId={runtimeId}
    />
  );
}

function PlaygroundRedirect(): JSX.Element {
  const location = useLocation();
  const { search = "" } = location;
  return (
    <Navigate
      to={replacePlaceholders(`/playground/${generateRandomName()}${search}`)}
      replace={true}
    />
  );
}
