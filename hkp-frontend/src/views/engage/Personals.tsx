import { FormField } from "semantic-ui-react";

export type PersonalData = {
  firstName: string;
  email: string;
};

type Props = {
  data: PersonalData;
  onChange: (updated: PersonalData) => void;
};

export default function Personals({ data, onChange }: Props) {
  const { firstName, email } = data;
  return (
    <>
      <FormField>
        <label>First Name</label>
        <input
          placeholder="First Name"
          value={firstName}
          onChange={(ev) => onChange({ ...data, firstName: ev.target.value })}
        />
      </FormField>
      <FormField>
        <label>Email</label>
        <input
          placeholder="Email"
          value={email}
          onChange={(ev) => onChange({ ...data, email: ev.target.value })}
        />
      </FormField>
    </>
  );
}
