import { Component } from "react";
import { Copy } from "lucide-react";

import GroupLabel from "@/ui-components/GroupLabel";
import Input from "@/ui-components/Input";

import Button from "@/ui-components/Button";
import { s, t } from "../styles";

export default class Copyable extends Component {
  copyToClipboard = () => {
    if (this.input) {
      navigator.clipboard.writeText(this.input.value);
    }
  };

  render() {
    const { label, value, style } = this.props;
    return (
      <div className="flex w-full items-center gap-2">
        <GroupLabel>{label}</GroupLabel>
        <Input
          ref={(input) => (this.input = input)}
          value={value}
          onChange={() => {}}
          fullWidth
          hideBottomBorder
        />
        <Button icon={<Copy />} onClick={this.copyToClipboard} />
      </div>
    );
  }
}
