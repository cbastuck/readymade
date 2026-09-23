import { BoardContextState } from "hkp-frontend/src/BoardContext";
import { extractText, resolvePath } from "./readValue";
import {
  useResolvedService,
  useServiceNotifications,
} from "./serviceNotifications";
import { FacadeNotice } from "./types";

/**
 * What a board says without being looked at.
 *
 * Everything else in a facade occupies a place: a widget is somewhere on a
 * panel, and it is there whether or not it has anything to show. That is the
 * right trade for a value a person came to read, and the wrong one for a
 * failure — a row kept free for an error spends layout on nothing almost always,
 * and on the rare occasion it fills, it speaks from wherever it happens to sit,
 * which on a long panel is somewhere nobody is looking.
 *
 * So a notice renders nothing at all. It listens where a widget would, and hands
 * what it hears to the app's own notification channel — the same toasts the rest
 * of the app already raises, in the same corner, dismissed the same way. A
 * facade does not get a second notification system, only the right to use the
 * one that is there.
 */

export function FacadeNotices({
  notices,
  boardContext,
}: {
  notices: FacadeNotice[] | undefined;
  boardContext: BoardContextState;
}) {
  if (!notices?.length) {
    return null;
  }
  return (
    <>
      {notices.map((notice, index) => (
        <Notice
          // Two notices may watch the same service for different fields, and a
          // board may list the same one twice; the position is what tells them
          // apart, and notices are not reordered while a board is open.
          key={`${notice.source.serviceUuid}:${notice.source.path ?? ""}:${index}`}
          notice={notice}
          boardContext={boardContext}
        />
      ))}
    </>
  );
}

function Notice({
  notice,
  boardContext,
}: {
  notice: FacadeNotice;
  boardContext: BoardContextState;
}) {
  const service = useResolvedService(boardContext, notice.source.serviceUuid);
  const push = boardContext.appContext?.pushNotification;

  useServiceNotifications(service, (notification) => {
    const value = notice.source.path
      ? resolvePath(notification, notice.source.path)
      : notification;
    const text = extractText(value);
    // A notification that does not carry this field is not this notice's news,
    // and a field carrying nothing is the service saying there is nothing wrong
    // — which is the usual case and the reason a notice costs no space.
    if (!text || !text.trim()) {
      return;
    }
    push?.({
      type: notice.tone ?? "error",
      message: notice.message
        ? notice.message.split("{{value}}").join(text)
        : text,
    });
  });

  return null;
}
