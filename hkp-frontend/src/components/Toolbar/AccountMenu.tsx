import AccountDropdown from "./AccountDropdown";

type Props = {
  appContext: any;
  boardContext: any;
};

export default function AccountMenu({ appContext, boardContext }: Props) {
  return (
    <AccountDropdown
      currentUser={appContext.user && appContext.user.username}
      onAction={(action: { type: string }) => {
        if (action.type === "logout") {
          appContext.logout();
        } else {
          boardContext.onAction(action);
        }
      }}
    />
  );
}
