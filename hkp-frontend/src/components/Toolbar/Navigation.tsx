import CompactNavMenu from "./CompactNavMenu";
import { AppContextState } from "../../AppContext";
import WideNavigationLinks from "./WideNavigationLinks";

type Props = {
  appContext: AppContextState | null;
  isCompact: boolean;
};

export default function Navigation({ isCompact }: Props) {
  return (
    <div
      style={{
        marginTop: 10,
        width: "100%",
        textAlign: "right",
        marginRight: 10,
      }}
    >
      {isCompact ? <CompactNavMenu /> : <WideNavigationLinks />}
    </div>
  );
}
