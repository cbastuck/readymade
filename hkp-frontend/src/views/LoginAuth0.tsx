import { useAuth0 } from "@auth0/auth0-react";

export default function LoginAuth0() {
  const { loginWithRedirect } = useAuth0();
  loginWithRedirect({
    appState: {
      returnTo: "/",
    },
  });
  return <div>Redirecting to login ...</div>;
}
