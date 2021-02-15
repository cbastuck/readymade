import React, { Component } from 'react';
import { 
  Input, 
  Modal, 
  Button,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class Prompt extends Component {
  state = {
    open: false,
    headline: '',
    value: '',
  };

  getInput = (headline, initial) => {
    return new Promise((resolve, reject) => {
      this.setState({ 
        headline, 
        open: true, 
        promise: { resolve, reject },
        value: initial,
      });
    })
  }

  render() {
    const { 
      open, 
      headline,
      value,
    } = this.state;
    return (
      <Modal
        onClose={() => {
          this.setState({ 
            open: false, 
            promise: null, 
            value: ''
          });
        }}
        onOpen={() => this.setState({ open: true })}
        open={open}
        dimmer="inverted"
      >
        <Modal.Header style={s(t.fs12, t.ls1, t.uc)}>
          {headline}
        </Modal.Header>
        <Modal.Content>
          <Input
            style={s(t.w100)}
            value={value}
            onChange={(ev, { value }) => this.setState({ value })}
          />
        </Modal.Content>
        <Modal.Actions>
        <Button
          style={s(t.fs12, t.ls1, t.uc)}
          color='red' 
          onClick={() => {
            const { promise } = this.state;
            const { resolve } = promise;
            resolve(null);
            this.setState({ open: false });
          }}
        >
          Cancel
        </Button>
        <Button
          style={s(t.uc, t.fs12, t.ls1)}
          content="Save"
          onClick={() => {
            const { promise, value } = this.state;
            const { resolve } = promise;
            resolve(value);
            this.setState({ open: false });
          }}
          positive
        />
      </Modal.Actions>
      </Modal>
    );
  }
}