import React, { Component } from 'react';
import {
  Button,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class Copyable extends Component {
  copyToClipboard = () => {
    if (this.input) {
      this.input.select();
      this.input.setSelectionRange(0, 99999);
      document.execCommand('copy');
    }
  }

  render() {
    const {
      label,
      value, 
      style
    } = this.props;
    return (
      <div style={s({ display: 'flex', flexDirection: 'row', width: '100%' })}>
        <div style={s(t.mt9, t.fs12, t.uc, t.ls1)}>{label}</div>
        <input
          ref={input => this.input = input}
          style={s(
            t.m(5, 0),
            t.p2,
            { border: 'solid 1px lightgray' },
            { color: 'darkgray' },
            { flexGrow: 2 },
            style
          )} 
          value={value}
          onChange={() => {}}
        />
        <Button 
          style={{ width: 50 }} 
          icon="copy outline"
          onClick={this.copyToClipboard}
        />
      </div>
    );
  }
}