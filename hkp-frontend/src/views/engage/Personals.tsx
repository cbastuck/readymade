import { FormField } from "semantic-ui-react";

export type PersonalData = {
  firstName: string;
  email: string;
};

type Props = {
  data: PersonalData;
  onChange: (updated: PersonalData) => void;
};

const emailRegex = /[a-zA-Z0-9.-_]{1,}@[a-zA-Z.-]{2,}[.]{1}[a-zA-Z]{2,}/;

export default function Personals({ data, onChange }: Props) {
  const { firstName, email } = data;
  const emailIsValid = !email || email.match(emailRegex);
  return (
    <>
      <FormField>
        <label>Name</label>
        <input
          className={email && !firstName ? "hkp-inp-error" : ""}
          placeholder="First Name or Nickname"
          value={firstName}
          onChange={(ev) => onChange({ ...data, firstName: ev.target.value })}
        />
      </FormField>
      <FormField>
        <label>Email</label>
        <input
          className={
            !emailIsValid || (firstName && !email) ? "hkp-inp-error" : ""
          }
          type="text"
          placeholder="Email"
          value={email}
          onChange={(ev) => onChange({ ...data, email: ev.target.value })}
        />
      </FormField>
    </>
  );
}
