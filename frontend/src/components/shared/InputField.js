import React, { Component } from 'react';

import { Input, Checkbox } from 'semantic-ui-react';

import SyncIndicator from './SyncIndicator';
import { s, t } from '../../styles';

export default class InputField extends Component {
  state = {
    value: ''
  };

  componentDidMount() {
    const { value, synced=true } = this.props;
    if (synced) {
      this.setState({ 
        value,
      });
    }
  }

  componentDidUpdate(prevProps) {
    const { value, synced=true } = this.props;
    if (synced) {
      if (value !== prevProps.value) {
        this.setState({ value });
      }
    }
  }

  renderCheckboxType = value => {
    const {
      onChange = () => {}, 
    } = this.props;
    return (
      <Checkbox
        style={{ padding: '5px 5px' }}
        slider
        checked={value !== undefined ? value : false}
        onChange={(ev, { checked }) => {
          onChange(ev, { value: checked });
        }}
      />
    );
  }

  renderInputType = (value, type, fontSize, synced) => {
    const {
      disabled,
      unit,
      onChange = () => {}, 
      onEscape = () => {},
      onFocus = () => {},
    } = this.props;
    return (
      <div 
        style={{ 
          width: '50%', 
          flexGrow: 3, 
          display: 'flex', 
          flexDirection: 'row' 
        }}
      >
        <Input 
          style={{
            fontSize, 
            height: 33, 
            // height: '90%',
            width: '100%',
            flexGrow: 3
          }}
          type={type}
          value={value === undefined ? '' : value}
          onChange={(ev, { value: rawValue }) => {
            const value = type === 'number' ? Number(rawValue) : rawValue;
            synced ? 
              this.setState({ value }) : 
              onChange(ev, { value })
          }}
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

  render() {
    const { 
      type, 
      label,
      labelStyle,
      style,
      value: syncedValue,
      onChange = () => {}, 
      onLabelClicked = () => {},
      synced = true,
    } = this.props;
    const value = synced ? this.state.value : syncedValue;
    const inSync = synced ? (value === syncedValue) : true;
    const fontSize = 11;
    return (
      <div 
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          margin: '0px 0px',
          ...style, 
        }}
      >  
        <SyncIndicator 
          onClick={ev => inSync ? 
            onLabelClicked(ev, { value }) : 
            onChange(ev, { value })
          }
          inSync={synced ? inSync : true}
          label={label}
          style={{ ...labelStyle, fontSize }}
        />
        {
          type !== 'checkbox' ? 
            this.renderInputType(value, type, fontSize + 1, synced) : 
            this.renderCheckboxType(syncedValue)
        }
      </div>
    );
  }
}