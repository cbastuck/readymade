import { Toaster } from "hkp-frontend/src/ui-components/primitives/sonner";
import { useContext } from "react";
import { BoardCtx } from "./BoardContext";
import { NotificationType } from "./types";

export function usePushNotifications() {
  const boardContext = useContext(BoardCtx);
  return (message: string, type: NotificationType = "info") =>
    boardContext?.appContext?.pushNotification({
      type,
      message,
    });
}

export default function Notifications() {
  return <Toaster closeButton duration={5000} />;
}
