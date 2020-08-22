import React, { Component } from 'react';

import { Label, Input } from 'semantic-ui-react';

class SyncIndicator extends Component {
  render() {
    return (
      <div 
        style={{ 
          width: 12,
          height: 12,
          margin: '8px 10px',
          backgroundColor: 'green',
        }}
      />
    );
  }
}

export default class InputField extends Component {
  render() {
    const { type, label, value, onChange } = this.props;
    const fontSize = 11;
    return (
      <div 
        style={{ 
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Label 
          style={{
            backgroundColor: '#E8E8E8',
            borderRadius: 2,
            maxWidth: 150,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize,
            textAlign: 'center',
            paddingTop: 10,
            flexGrow: 1,
          }}
        > 
          {label} 
        </Label>
        <Input 
          type={type}
          value={value}
          onChange={onChange}
          style={{ width: '50%', fontSize: fontSize + 1, flexGrow: 3, }}
        />
        <SyncIndicator />
      </div>
    );
  }
}