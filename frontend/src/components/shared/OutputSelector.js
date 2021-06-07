import React, { Component } from 'react';
import {Button } from 'semantic-ui-react';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'none';

export default class OutputSelector extends Component {
  state = {
    selected: none,
    expanded: false,
  } 

  renderExpanded = () => {
    const { selected } = this.state;
    const { items, onSelect, onUpdate } = this.props;
    const peerOptions = items.reduce((a, c) => (
      { ...a, [c]: c}), 
      { none }
    );
    return (
      <div style={{ padding: 10 }}>
        <h1 style={s(t.tc, t.fs11)}>Route to</h1>
        <SelectorField
          label="Output"
          options={peerOptions}
          value={selected}
          onChange={(ev, { value: selected }) => {
            this.setState(
              { selected },
              () => onSelect(selected)
            );
          }}
        />
      <Button
        style={s(t.uc, t.fs11, t.ls1, t.mt2)}
        onClick={() => onUpdate()}
      >
        Update Peers
      </Button>
      </div>
    );
  }

  render() {
    const { expanded } = this.state;
    const { 
      onExpand,
      onCollapse,
    } = this.props;
    return (
      <div 
        style={s(
          t.uc, t.ls1, t.fs12, 
          { 
            height: '90%',
            minHeight: 140,
            minWidth: expanded && 200,
            marginTop: 10,
          },
          {   
            border: 'solid 1px lightgray',
            borderRight: 'none',
            borderRadius: 5,
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          },
          { 
            display: 'flex',
            flexDirection: 'row',
          }
        )}
      >
      <button
        style={{
          height: '100%',
          border: 'none',
          textAlign: 'center',
          backgroundColor: expanded ? 'gray' : '#efefef'
        }}
        onClick={() => { 
          this.setState(
            { expanded: !expanded }, 
            () => {
              if (expanded) {
                onCollapse && onCollapse();
              } else {
                onExpand && onExpand();
              }
            }
          );
        }}
      >
        <div
          style={
            s(
              t.uc, t.ls1, t.fs10,
              { 
                transform: 'rotate(-90deg)',
                marginTop: 35,
                width: 8,
                color: expanded ? 'white' : '#333'
              },
            )}
        >
          Outputs 
        </div>
      </button>
      { expanded && this.renderExpanded() }
      </div>
    );
  }
}