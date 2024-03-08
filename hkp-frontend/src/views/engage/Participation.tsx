import { FormField, Checkbox, CheckboxProps } from "semantic-ui-react";

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
    (ev: React.FormEvent<HTMLInputElement>, { checked }: CheckboxProps) => {
      if (checked !== undefined) {
        onTcChanged(checked);
      }
    },
    [onTcChanged]
  );
  return (
    <>
      <Personals data={personals} onChange={onPersonalsChanged} />
      <FormField
        style={{ marginTop: "20px", display: "flex", flexDirection: "row" }}
      >
        <Checkbox label="" checked={tcAgreed} onChange={onTc} />
        <span>
          I agree to the{" "}
          <a href="/terms" target="_blank">
            Terms and Conditions
          </a>
        </span>
      </FormField>
    </>
  );
}
