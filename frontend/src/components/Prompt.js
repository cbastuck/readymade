import React, { Component } from 'react';
import { 
  Modal, 
  Button,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class Prompt extends Component {
  state = {
    open: false,
  };

  getInput = () => {
    return new Promise((resolve, reject) => {
      this.setState({ 
        open: true, 
        promise: { resolve, reject },
      });
    })
  }

  render() {
    const { open } = this.state;
    const {
      children=false,
      headline='Headline missing'
    } = this.props;
    return (
      <Modal
        onClose={() => {
          this.setState({ 
            open: false, 
            promise: null,
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
          { children }
        </Modal.Content>
        <Modal.Actions>
          <Button
            style={s(t.fs12, t.ls1, t.uc)}
            onClick={() => {
              const { promise } = this.state;
              const { resolve } = promise;
              this.setState({ open: false });
              resolve(null);
            }}
          >
            Cancel
          </Button>
          <Button
            style={s(t.uc, t.fs12, t.ls1)}
            onClick={() => {
              const { promise } = this.state;
              const { resolve } = promise;
              resolve();
              this.setState({ open: false });
            }}
          >
            OK
          </Button>
        </Modal.Actions>
      </Modal>
    );
  }
}