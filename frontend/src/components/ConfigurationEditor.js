import React, { Component } from 'react';
import { Button, Segment } from 'semantic-ui-react';

import Editor from './shared/Editor/index';
import { filterPrivateMembers } from '../runtime/services/helpers';
import { s, t } from '../styles';

export default class ConfigurationEditor extends Component {
  render() {
    const { 
      service,
      onClose,
      onChange,
    } = this.props;
    const { uuid, board, ...filteredService } = filterPrivateMembers(service);
    const buttonStyle = s(t.uc, t.fs12, t.ls1);
    return (
      <div>
        <h1 style={s(t.uc, t.fs12, t.ls1)}>Configuration</h1>
        <Segment style={{ height: 250, margin: 5 }}>
          <Editor 
            ref={editor => this.editor = editor}
            value={JSON.stringify(filteredService, null, 2)}
            language="json"
          />
        </Segment>
        <div 
          style={{ 
            display: 'flex', 
            flexDirection:'row',
            margin: 10,
            textAlign: 'center',
            width: '100%'
          }}
        >
          <Button 
            style={buttonStyle} 
            onClick={onClose}
          >
            Close
          </Button>
          <Button 
            style={buttonStyle} 
            onClick={() => onChange(this.editor.getValue())}
          >
            Update
          </Button>
        </div>
      </div>
    );
  }
}