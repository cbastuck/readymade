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
    const { value } = this.props;
    if (value !== prevProps.value) {
      this.setState({ value });
    }
  }

  render() {
    const { 
      value,
      optionsVisible
    } = this.state;
    const { 
      label, 
      onChange, 
      value: syncedValue,
      options={},
      style={}
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
            left: -2
          }}
          onClick={() => this.setState({ optionsVisible: !optionsVisible })}
        > 
          { text }
          <span style={{ marginLeft: 5 }}> ⬇ </span>
          {
            optionsVisible && (
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
          </div>
      </div>
    );
  }
}