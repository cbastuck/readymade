import React, { Component } from 'react';

import { Label, Input } from 'semantic-ui-react';

class SyncIndicator extends Component {
  render() {
    const { inSync, onClick } = this.props;
    return (
      <div 
        style={{ 
          width: 18,
          height: 18,
          margin: '8px 10px',
          backgroundColor: inSync ? 'green' : 'yellow',
          cursor: !inSync ? 'pointer' : undefined,
        }}
        onClick={ev => !inSync && onClick(ev)}
      />
    );
  }
}

export default class InputField extends Component {
  state = {
    value: ''
  };

  componentDidMount() {
    this.setState({ value: this.props.value });
  }

  componentDidUpdate(prevProps) {
    if (this.props.value !== prevProps.value) {
      this.setState({ value: this.props.value });
    }
  }

  render() {
    const { value } = this.state;
    const { type, label, onChange, value: syncedValue } = this.props;
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
          style={{ width: '50%', fontSize: fontSize + 1, flexGrow: 3, }}
          type={type}
          value={value}
          onChange={(_, { value }) => this.setState({ value })}
          onKeyUp={ev => ev.key === 'Enter' && onChange(ev, { value })}
        />
        <SyncIndicator 
          onClick={ev => onChange(ev, { value })}
          inSync={value === syncedValue}
        />
      </div>
    );
  }
}