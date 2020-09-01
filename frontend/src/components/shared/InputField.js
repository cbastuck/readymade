import React, { Component } from 'react';

import { Label, Input } from 'semantic-ui-react';

import { labelWidth, labelHeight } from './Defaults';
import SyncIndicator from './SyncIndicator';

export default class InputField extends Component {
  state = {
    value: ''
  };

  componentDidMount() {
    const { value } = this.props;
    this.setState({ 
      value,
    });
  }

  componentDidUpdate(prevProps) {
    const { value } = this.props;
    if (value !== prevProps.value) {
      this.setState({ value });
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
          margin: '2px 0px',
        }}
      >
        <Label 
          style={{
            backgroundColor: '#E8E8E8',
            borderRadius: 2,
            width: labelWidth,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize,
            textAlign: 'center',
            paddingTop: 10,
            height: labelHeight
          }}
        > 
          { label } 
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