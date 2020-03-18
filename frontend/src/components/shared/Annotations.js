import React, { Component } from 'react';
import {
  Input,
} from 'semantic-ui-react';

import './Annotations.css';

export default class Annotations extends Component {
  render() {
    const { values, id, onEnter, onChange } = this.props;
    if (!values) {
      return false;
    }
    const vspace = { marginBottom: 5 };
    return Object.keys(values).map((key, i) => (
      <div className="annotations" key={`annotation-${id}-${i}`}>
        <Input
          style={{ ...vspace, width: '100%' }}
          type="text"
          value={key}
          label="Key"
          labelPosition="left"
          onChange={(_, { value: newKey }) => onChange(
            Object.keys(values).reduce(
              (all, oldKey) => {
                // replace the old key with the new key preserving the value
                const k = (oldKey === key) ? newKey : oldKey;
                return { ...all, [k]: values[oldKey] };
              },
              {}
            )
          )}
          onKeyPress={e => e.key === 'Enter' && onEnter()}
        />
        <Input
          style={{ ...vspace, width: '100%' }}
          type="text"
          value={values[key]}
          label="Value"
          labelPosition="left"
          onChange={(_, { value }) => 
            this.setState({ 
              annotations: { 
                ...values,
                [key]: value
              }
            })
          }
          onKeyPress={e => e.key === 'Enter' && onEnter()}
        />
      </div>
    ));
  }
}