import { useEffect } from "react";

import MessageDispatcher from "./MessageDispatcher";

type Props = {
  state: string;
  onData: (data: Record<string, unknown>) => void;
};

export default function MessageReceiver({ state, onData }: Props) {
  useEffect(() => {
    MessageDispatcher.registerRedirect(state, onData);
    return () => {
      MessageDispatcher.unregisterRedirect(state);
    };
  }, [state, onData]);

  return null;
}
