import { useEffect } from "react";

export default function ServiceRedirect() {
  useEffect(() => {
    const hs = Object.fromEntries(new URLSearchParams(window.location.hash));
    const qs = Object.fromEntries(new URLSearchParams(window.location.search));
    const message = JSON.stringify({ ...qs, ...hs });

    if (window.opener) {
      (window.opener as Window).postMessage(message);
    }

    setTimeout(() => window.close(), 300);
  }, []);

  return <div>Redirecting…</div>;
}
