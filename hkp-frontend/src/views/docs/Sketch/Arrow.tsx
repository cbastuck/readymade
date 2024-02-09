import { Icon } from "semantic-ui-react";

type Props = {
  yOffset: number;
};

export default function Arrow({ yOffset }: Props) {
  return (
    <Icon
      style={{ margin: 5, marginTop: yOffset }}
      name="chevron right"
      size="large"
    />
  );
}
