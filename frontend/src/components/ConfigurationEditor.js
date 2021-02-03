import React, { Component } from 'react';
import { Button, Segment } from 'semantic-ui-react';

import Resizable from './Resizable';
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
    const buttonStyle = s(t.uc, t.fs12, t.ls1, { flexGrow: 1});
    return (
      <Resizable>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <h1 style={s(t.uc, t.fs13, t.ls1)}>Service Configuration</h1>
          <Segment 
            style={{
              minHeight: 180,
              height: '100%', 
              margin: 5,
              flexGrow: 1,
            }}
          >
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
      </Resizable>
    );
  }
}