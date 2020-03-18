import React, { Component } from 'react';
import {
  Input,
  Button,
} from 'semantic-ui-react';

import './Annotations.css';

const newAnnotation = { key: 'value' };

export default class Annotations extends Component {
  componentDidMount() {
    this.setState({
      annotations: this.props.initial || {},
      addAnnotation: null,
    })
  }

  render() {
    const { service } = this.props;
    const { annotations = {}} = this.state || {};
    const vspace = { marginBottom: 5 };
    return (
      <div className="annotation-header">
        {
          Object.keys(annotations).map((key, i) => (
            <div className="annotations" key={`annotation-${service.uuid}-${i}`}>
              <Input
                style={{ ...vspace, width: '100%' }}
                type="text"
                value={annotations[key]}
                label={key}
                labelPosition="left"
                onKeyChanged={(_, { value: newKey }) => 
                  Object.keys(annotations).reduce(
                    (all, oldKey) => {
                      // replace the old key with the new key preserving the value
                      const k = (oldKey === key) ? newKey : oldKey;
                      return { ...all, [k]: annotations[oldKey] };
                    },
                    {}
                  )
                }
                onChange={(_, { value }) => 
                  this.setState({ 
                    annotations: { 
                      ...annotations,
                      [key]: value
                    }
                  })
                }
                onKeyPress={
                  e => {
                    if (e.key === 'Enter') {
                      service.configure({ annotations });
                    }
                  }
                }
              />
            </div>
          ))
        }
        <Button
          style={{ marginTop: 1, width: '100%' }}
          onClick={() => {
            if (this.state.addAnnotation) {
              // commit the new property
              this.setState({ addAnnotation: null });
            } else {
              this.setState({ addAnnotation: newAnnotation });
            }
          }}
        >
          Add Annotation
        </Button>
      </div>
    );
  }
}