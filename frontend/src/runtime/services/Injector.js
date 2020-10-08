import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';
 
import ServiceUI from './ServiceUI';
import Editor from '../../components/shared/Editor/index';
import DropZone from '../../components/shared/DropZone';

const serviceId = 'hookup.to/service/injector';
const serviceName = 'Injector';

class InjectorUI extends Component {
  state = {
    files: [],
    user: undefined,
    initialCode: JSON.stringify({key: "value"}, null, 2),
    blob: null,
    dropName: undefined,
  };

  onInit = service => {
    this.service = service;
  }

  renderBinaryInput = service => {
    const { dropName } = this.state;
    return (
      <div
        style={{
          width: 200,
        }}
      >
        <DropZone 
          label={dropName || 'Drop Zone'}
          onFiles={files => {
            const isArray = files.length > 1;
            const blob = isArray ? 
                Array.from(files):
                files[0];
            const dropName = isArray ? 'multiple files' : blob.name
            this.setState({ blob, dropName });
          }}
        />
        <Button
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            width: '100%',
            marginTop: 5,
          }}
          onClick={() => service.inject(this.state.blob)}
          disabled={!this.state.blob}
        >
          Inject
        </Button>
      </div>
    );
  }

  renderTextInput = service => {
    const { initialCode } = this.state;
    return (
      <div>
        <Editor 
          ref={editor => this.editor = editor}
          value={initialCode}
          language="json"
        />
        <Button
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 1,
            width: '100%',
            marginTop: 5
          }}
          onClick={() => {
            const code = this.editor.getValue();
            try {
              const obj = JSON.parse(code);
              service.inject(obj);
            } catch (err) {
              service.inject(code); // can we check of the text is valid JSON from the editor?
            }
          }}
        >
          Inject
        </Button>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Text', render: this.renderTextInput },
          { name: 'Binary', render: this.renderBinaryInput },
        ]}
      />
    )
  }
}

class Injector {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) { 
  }

  inject(data) {
    this.app.next(this, data);
  }

  process(params) {
    return params;
  }
}


const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Injector(app, board, descriptor, id),
  createUI: InjectorUI,
};

export default descriptor;
