import { Checkbox } from "hkp-frontend/src/ui-components/primitives/checkbox";

import Personals, { PersonalData } from "./Personals";
import { useCallback } from "react";

type Props = {
  tcAgreed: boolean;
  personals: PersonalData;
  onPersonalsChanged: (updated: PersonalData) => void;
  onTcChanged: (checked: boolean) => void;
};

export default function Participation({
  tcAgreed,
  personals,
  onPersonalsChanged,
  onTcChanged,
}: Props) {
  const onTc = useCallback(
    (checked: boolean) => {
      if (checked !== undefined) {
        onTcChanged(checked);
      }
    },
    [onTcChanged]
  );
  return (
    <div className="p-2">
      <Personals data={personals} onChange={onPersonalsChanged} />
      <div className="mt-[20px] flex gap-2 items-center">
        <Checkbox checked={tcAgreed} onCheckedChange={onTc} />
        <div className="text-base">
          I agree to the{" "}
          <a href="/terms" target="_blank">
            Terms and Conditions
          </a>
        </div>
      </div>
    </div>
  );
}
