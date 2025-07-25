import { useContext, useEffect } from "react";

import { AppCtx } from "hkp-frontend/src/AppContext";

export default function LoginAuth0() {
  const context = useContext(AppCtx);
  useEffect(() => {
    const t = setTimeout(() => {
      context.logout();
      window.location.pathname = "/";
    }, 10);
    return () => clearTimeout(t);
  }, [context]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      You've been successfully logged out ...
    </div>
  );
}
