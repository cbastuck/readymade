import { useContext } from "react";
import { AppCtx } from "../../AppContext";
import AccountDropdown from "./AccountDropdown";

export default function AccountMenu() {
  const appContext = useContext(AppCtx);
  return <AccountDropdown currentUser={appContext?.user || null} />;
}
