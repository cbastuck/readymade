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
      options={},
      style={}
    } = this.props;
    const text = options[value];
    const fontSize = 11;
    return (
      <div
        ref={root => this.root = root}
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
        { 
          !this.state.optionsVisible ? (
            <div
              ref={container => this.optionsContainer = container}
              style={{ 
                textTransform: 'uppercase', 
                fontSize: 12,
                padding: 8,
                border: 'solid 1px #DDD',
                borderRadius: 3,
                width: '100%',
                flexGrow: 3,
                height: 33,
                textAlign: 'left',
                whiteSpace: 'nowrap',
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
                position: 'absolute',
                left: (this.optionsContainer && this.root) ? 
                  this.optionsContainer.getBoundingClientRect().left - this.root.getBoundingClientRect().left + 20: 
                  0
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
                    whiteSpace: 'nowrap',
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
    );
  }
}