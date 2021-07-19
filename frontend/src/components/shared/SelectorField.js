import React, { Component } from 'react';

import SyncIndicator from './SyncIndicator';

import './SelectorField.css';

export default class SelectorField extends Component {
  state = {
    value: '',
    optionsVisible: false
  };

  componentDidMount() {
    const { value } = this.props;
    this.setState({ value });
  }

  componentDidUpdate(prevProps) {
    const { 
      value, 
      highlight,
    } = this.props;
    if (value !== prevProps.value) {
      this.setState({ value });
    }

    if (highlight !== prevProps.highlight) {
      this.setState({ highlight });
    }
  }

  renderOptions = () => {
    const { 
      label='', 
      onChange=undefined, 
      options={},
      highlight=undefined,
    } = this.props;
    return (
      <div
        style={{
          textAlign: 'left',
          textTransform: 'uppercase',
          backgroundColor: 'white',
          position: 'absolute',
          zIndex: 2000003,
          margin: '0px -5px',
        }}
      >
      {
        Object.keys(options).map((key, idx) => 
          <div 
            key={`${label}.${key}.${idx}`}
            className="selector-field-option"
            style={{ 
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              padding: '3px 10px',
              backgroundColor: highlight === key && '#8aa1b733'
            }}
            onClick={ev => {
              onChange && onChange(ev, { value: key });
              this.setState({ optionsVisible: false });
            }}
          >
            { options[key] }
          </div>
        )
      }
      </div>
    )
  }

  render() {
    const { 
      value,
      optionsVisible
    } = this.state;
    const { 
      label, 
      onChange,
      onOpen,
      disabled=false,
      value: syncedValue,
      options={},
      style={},
    } = this.props;
    const text = options[value];
    const fontSize = 11;
    return (
      <div
        style={{ 
          ...style,
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <SyncIndicator 
          onClick={ev => onChange && onChange(ev, { value })}
          inSync={value === syncedValue}
          label={label}
          style={{
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize,
          }}
        />          
        <div
          style={{ 
            textTransform: 'uppercase', 
            fontSize: 12,
            padding: 8,
            border: 'solid 1px #DDD',
            borderRadius: 3,
            flexGrow: 3,
            height: 33,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            position: 'relative',
            left: -2,
            cursor: disabled ? 'not-allowed' : 'pointer',
            backgroundColor: disabled && 'lightgray',            
            color: disabled && 'darkgray'
          }}
          onClick={() => !disabled && this.setState(
            { optionsVisible: !optionsVisible },
            () => onOpen && onOpen(options)
          )}
        > 
          { text }
          <span style={{ marginLeft: 5 }}> ⬇ </span>
          { optionsVisible && this.renderOptions() }
        </div>
      </div>
    );
  }
}