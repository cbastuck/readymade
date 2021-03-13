import React, { Component } from 'react';
import { Label } from 'semantic-ui-react';

import Tooltip from './Tooltip';
import { labelWidth, labelHeight } from './Defaults';

export default class SyncIndicator extends Component {
  render() {
    const { 
      style,
      inSync,
      onClick,
      label, 
    } = this.props;
    return typeof label === 'string' ? (
      <div>
        <Tooltip 
          text={label}
        >
          <Label 
            style={{
              backgroundColor: '#E8E8E8',
              borderRadius: 2,
              textTransform: 'uppercase',
              letterSpacing: 1,
              textAlign: 'center',
              paddingTop: 10,
              minWidth: labelWidth,
              minHeight: labelHeight,
              color: !inSync && 'red',
              cursor: !inSync ? 'pointer' : undefined,
              overflow: 'hidden',
              textOverflow: 'ellipsis', 
              ...style
            }}
            onClick={onClick}
          > 
            { label }
          </Label>
        </Tooltip>
      </div>
    ) : 
    label;
}

  renderOld() {
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
