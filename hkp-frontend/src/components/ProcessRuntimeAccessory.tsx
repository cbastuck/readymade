import { Icon } from "semantic-ui-react";

import "./ProcessRuntimeAccessory.css";

type Props = {
  onProcess: () => void;
};

export default function ProcessRuntimeAccessory({ onProcess }: Props) {
  return (
    <button
      className="ui mini icon runtime-accessory-button"
      onClick={onProcess}
    >
      <Icon name="play" />
    </button>
  );
}
