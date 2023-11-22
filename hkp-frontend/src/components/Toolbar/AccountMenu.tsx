import { AppContextState } from "../../AppContext";
import AccountDropdown from "./AccountDropdown";

type Props = {
  appContext: AppContextState;
};

export default function AccountMenu({ appContext }: Props) {
  return <AccountDropdown currentUser={appContext.user} />;
}
