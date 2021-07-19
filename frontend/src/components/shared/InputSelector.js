import React, { Component } from 'react';

import { s, t } from '../../styles';
import SelectorField from './SelectorField';

const none = 'No Input';
const all = 'All Peers';

export default class InputSelector extends Component {
  state = {
    selected: 'none',
    expanded: false,
    incoming: false,
  }

  static updatePeersAction = 'update-peers';

  componentDidUpdate(prevProps) {
    if (this.props.items !== prevProps.items) {
      const options = this.getSelectorOptions();
      if (!options[this.state.selected]) {
        this.setState({ selected: 'none' });
      }
    }
  }

  getSelectorOptions = () => {
    const { items } = this.props; 
    return items.reduce((a, c) => (
      { ...a, [c]: c}), 
      { none: none, all: all }
    );
  }

  signalIncoming = sender => {
    if (!this.state.incoming) {
      this.setState(
        { incoming: sender },
        () => setTimeout(this.resetIncoming, 1000)
      );
    }
  }

  resetIncoming = () => {
    this.setState({ incoming: undefined });
  }

  renderExpanded = () => {
    const { selected, incoming } = this.state;
    const { 
      onSelect, 
      onAction,
      children,
      disabled
    } = this.props;
    const peerOptions = this.getSelectorOptions();
    return (
      <div style={{ padding: 10 }}> 
        <h1 style={s(t.tc, t.fs11)}>Allow From</h1>
        <SelectorField
          label="Peer"
          options={peerOptions}
          highlight={incoming}
          value={selected}
          disabled={disabled}
          onChange={(_ev, { value: selected }) => 
            this.setState(
              { selected },
              () => {
                switch (selected) {
                  case 'none':
                    onSelect(null);
                  break;
                  case 'all':
                    onSelect('*');
                  break;
                  default:
                    onSelect(selected);
                  break;
                }
              }
            )
          }
          onOpen={() => onAction({type: InputSelector.updatePeersAction })}
        />
        { children ? children : false }
      </div>
    );
  }

  render() {
    const { 
      expanded,
      incoming,
    } = this.state;
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
            borderLeft: 'none',
            borderRadius: 5,
            borderTopLeftRadius: 0, 
            borderBottomLeftRadius: 0,
          },
          { 
            display: 'flex',
            flexDirection: 'row',
          }
        )}
      >
      { expanded && this.renderExpanded() } 
      <button
        style={{
          height: '100%',
          border: 'none',
          textAlign: 'center',
          backgroundColor: incoming ? 
            '#8aa1b7' : ( // signal color 
            expanded ? 
              'gray' : 
              '#efefef'
            )
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
          Input
        </div>
      </button>
      </div>
    );
  }
}