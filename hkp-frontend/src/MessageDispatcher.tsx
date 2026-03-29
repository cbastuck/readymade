import { useEffect } from "react";

type RedirectCallback = (data: Record<string, unknown>) => void;

export const redirects: Record<string, RedirectCallback> = {};

export function registerRedirect(state: string, callback: RedirectCallback): void {
  redirects[state] = callback;
}

export function unregisterRedirect(state: string): void {
  delete redirects[state];
}

export default function MessageDispatcher() {
  useEffect(() => {
    const onMsgReceived = (ev: MessageEvent) => {
      try {
        const data =
          ev.data && typeof ev.data === "string" && JSON.parse(ev.data);
        if (data.state) {
          const callback = redirects[data.state];
          if (callback) {
            callback(data);
          } else {
            console.warn(`Received message with unknown state: ${data.state}`);
          }
        }
      } catch (err) {
        // console.log(`MessageDispatcher: string message is not a valid JSON: ${ev.data}`)
      }
    };
    window.addEventListener("message", onMsgReceived, false);

    return () => {
      window.removeEventListener("message", onMsgReceived, false);
    };
  }, []);

  return null;
}

// Keep static-style API for external callers
MessageDispatcher.redirects = redirects;
MessageDispatcher.registerRedirect = registerRedirect;
MessageDispatcher.unregisterRedirect = unregisterRedirect;
