import Notification from "./Notification";

import { AppConsumer } from "./AppContext";

export default function Notifications() {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 40,
        width: "50%",
        margin: "auto",
      }}
    >
      <AppConsumer>
        {({ notifications, popNotification }) => {
          return notifications.length === 0 ? null : (
            <Notification value={notifications[0]} onClose={popNotification} />
          );
        }}
      </AppConsumer>
    </div>
  );
}
