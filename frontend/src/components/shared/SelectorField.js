import React, { Component } from 'react';

import { Label } from 'semantic-ui-react';

import SyncIndicator from './SyncIndicator';

import { labelWidth, labelHeight } from './Defaults';

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
    const { label, onChange, value: syncedValue, options } = this.props;
    const text = options[value];
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
            width: labelWidth,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize,
            textAlign: 'center',
            paddingTop: 10, 
            height: labelHeight
          }}
        > 
          {label} 
        </Label>
        { 
          !this.state.optionsVisible ? (
            <div 
              style={{ 
                textTransform: 'uppercase', 
                fontSize: 12,
                padding: 8,
                border: 'solid 1px #DDD',
                borderRadius: 3,
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
                textTransform: 'uppercase'
              }}
            >
            {
              Object.keys(options).map((key, idx) => 
                <div 
                  style={{ cursor: 'pointer' }}
                  key={`${label}.${key}.${idx}`}
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
        <SyncIndicator 
          onClick={ev => onChange(ev, { value })}
          inSync={value === syncedValue}
        />
      </div>
    );
  }
}