import React, { Component } from "react";
import { Input, TextArea, Label } from "semantic-ui-react";

import Prompt from "./Prompt";
import { s, t } from "../styles";

export default class SaveBoardPrompt extends Component {
  state = {
    name: "",
    description: "",
  };

  getInput = async (initial) => {
    this.setState({
      name: initial,
    });
    const res = await this.prompt.getInput();
    if (res === null) {
      return null;
    }

    return {
      name: this.state.name,
      description: this.state.description,
    };
  };

  render() {
    const { name, description } = this.state;
    return (
      <Prompt
        ref={(prompt) => (this.prompt = prompt)}
        headline="Enter a name for the board"
      >
        <Label style={s(t.uc, t.fs12, t.ls1)}>Name</Label>
        <Input
          style={s(t.w100)}
          value={name || ""}
          onChange={(ev, { value: name }) => this.setState({ name })}
        />
        <Label style={s(t.uc, t.fs12, t.ls1, t.mt10)}>Description</Label>
        <TextArea
          style={s(t.w100, t.p10, {
            border: "solid 1px lightgray",
            resize: "none",
          })}
          value={description || ""}
          onChange={(ev, { value: description }) =>
            this.setState({ description })
          }
        />
      </Prompt>
    );
  }
}
