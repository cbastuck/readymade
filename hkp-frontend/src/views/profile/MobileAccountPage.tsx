import MobilePage from "../playground/mobile/MobilePage";
import AccountPage from "./AccountPage";

type Props = {
  /** Leaves the account and returns to whatever the host was showing. */
  onBack: () => void;
};

/**
 * The account page as the touch hosts frame it: a full screen with a back
 * control, rather than a page under a toolbar. Same content as the desktop
 * page — only the frame differs, which is the whole reason `AccountPage`
 * renders no chrome of its own.
 */
export default function MobileAccountPage({ onBack }: Props) {
  return (
    <MobilePage title="Account" onBack={onBack}>
      <AccountPage />
    </MobilePage>
  );
}
