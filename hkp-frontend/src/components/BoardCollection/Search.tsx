import { Input } from "semantic-ui-react";

import { s, t } from "../../styles";

type Props = {
  filter: string;
  onChange: (filter: string) => void;
};

export default function Search({ filter, onChange }: Props) {
  return (
    <div style={s(t.tr, t.mb5)}>
      <Input
        style={{ width: 180 }}
        icon="search"
        value={filter}
        onChange={(_, { value }) => onChange(value.toLowerCase())}
      />
    </div>
  );
}
