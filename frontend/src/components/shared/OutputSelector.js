import React, { Component } from 'react';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'No routing';

export default class OutputSelector extends Component {
  state = {
    selected: 'none',
    expanded: false,
  };

  componentDidUpdate(prevProps) {
    if (this.props.items !== prevProps.items) {
      const options = this.getSelectorOptions();
      if (!options[this.state.selected]) { 
        this.setState({ selected: 'none' });
      }
    }
  }

  getSelectorOptions = () => {
    const { items } = this.props;
    return items.reduce(
      (a, c) => ({ ...a, [c]: c}), 
      { 'none': none },
    );
  }
  
  renderExpanded = () => {
    const { selected } = this.state;
    const { onSelect, onUpdate } = this.props;
    const peerOptions = this.getSelectorOptions();
    return (
      <div style={{ padding: 10 }}>
        <h1 style={s(t.tc, t.fs11)}>Route to</h1>
        <SelectorField
          label="Peer"
          options={peerOptions}
          value={selected}
          onChange={(ev, { value: selected }) => {
            this.setState(
              { selected },
              () => onSelect(selected === none ? null : selected)
            );
          }}
          onOptions={() => onUpdate()}
        />
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