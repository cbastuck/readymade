import React, { Component } from 'react';

import { Input } from 'semantic-ui-react';

import SyncIndicator from './SyncIndicator';
import { s, t } from '../../styles';

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
    const { 
      type, 
      label,
      labelStyle,
      style,
      disabled,
      value: syncedValue,
      unit,
      onChange = () => {}, 
      onEscape = () => {},
      onFocus = () => {},
      onLabelClicked = () => {},
    } = this.props;
    const fontSize = 11;
    const inSync = value === syncedValue;
    return (
      <div 
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          margin: '2px 0px',
          ...style, 
        }}
      >
        <SyncIndicator 
          onClick={ev => inSync ? 
            onLabelClicked(ev, { value }) : 
            onChange(ev, { value })
          }
          inSync={inSync}
          label={label}
          style={{ ...labelStyle, fontSize }}
        />
        <Input 
          style={{ width: '50%', fontSize: fontSize + 1, flexGrow: 3, }}
          type={type}
          value={value || ''}
          onChange={(_, { value }) => this.setState({ value })}
          onKeyUp={ev => {
            switch(ev.key) {
              case 'Enter':
                return onChange(ev, { value });
              case 'Escape':
                return onEscape && onEscape(ev, { value });
              default:
                break;
            }
          }}
          onFocus={() => onFocus && onFocus()}
          disabled={disabled}
        />
        { 
          unit && (
            <div style={s(t.uc, t.ls1, t.fs11, { marginLeft: 5, marginTop: 6 })}>
              { unit }
            </div>
          )
        }
      </div>
    );
  }
}