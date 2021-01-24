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
    const { value } = this.state;
    const { 
      label, 
      onChange, 
      value: syncedValue,
      options,
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
          onClick={ev => onChange(ev, { value })}
          inSync={value === syncedValue}
          label={label}
          style={{
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize,
          }}
        />
        { 
          !this.state.optionsVisible ? (
            <div 
              style={{ 
                textTransform: 'uppercase', 
                fontSize: 12,
                padding: 8,
                border: 'solid 1px #DDD',
                borderRadius: 3,
                width: '100%',
                flexGrow: 3,
                height: 33,
                textAlign: 'left'
              }}
              onClick={() => this.setState({ optionsVisible: true })}
            > 
              { text }
              <span style={{ marginLeft: 5 }}> ⬇ </span>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'left',
                textTransform: 'uppercase',
                backgroundColor: 'white',
                position: 'fixed',
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
                    padding: 5,
                  }}
                  onClick={ev => {
                    onChange(ev, { value: key });
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
    );
  }
}