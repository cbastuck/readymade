import React, { Component } from 'react';
import {
  Input,
  Label,
} from 'semantic-ui-react';

export default class InputLabelValue extends Component {
  componentDidMount() {
    this.setState({ 
      label: this.props.label,
      value: this.props.value,
      editLabel: null,
      renamedLabelBuffer: null,
    });
  }

  render() {
    const { onCommit } = this.props;
    const { label='', value = '', editLabel, renamedLabelBuffer } = this.state || {};
    const vspace = { marginBottom: 5 }
    return (
      <Input
        type="text"
        style={{ ...vspace, width: '100%' }}
        label={editLabel === label ? 
          <Input
            value={renamedLabelBuffer === null ? editLabel : renamedLabelBuffer}
            ref={element => element && element.focus()}
            onChange={(_, { value: renamedLabelBuffer }) => this.setState({ renamedLabelBuffer })}
            onKeyDown={e => {
              switch(e.key) {
                case 'Enter':
                  onCommit({ 
                    label: renamedLabelBuffer === null ? editLabel : renamedLabelBuffer, 
                    value 
                  });
                  break;
                case 'Escape':
                  break;
                default: 
                  return;
              }
              this.setState({ 
                editLabel: null,
                renamedLabelBuffer: null,
              });
            }}
          /> :
          <Label 
            onClick={() => this.setState({ editLabel: label })}
          >
            {label}
          </Label>
        }
        labelPosition="left"
        value={value}
        onChange={(_, { value }) => this.setState({ value })}
        onKeyPress={
          e => (e.key === 'Enter') &&
            onCommit({ label, value })
        }
      />
    );
  }
}