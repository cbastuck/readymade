import React, { Component } from 'react';
import { Dimmer, Loader } from 'semantic-ui-react';

async function initialize() {
  const monaco = await import('monaco-editor');
  //const require = await import('./loader.min');

  //const baseUrl = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min';
  const baseUrl = `${window.location.origin}/res/monaco-editor/0.21.2`;
  require.config({ 
    paths: { 
      vs: `${baseUrl}/vs`
    }
  });

  window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
        self.MonacoEnvironment = {
          baseUrl: '${baseUrl}/'
        };
        importScripts('${baseUrl}/vs/base/worker/workerMain.js');`
      )}`;
    }
  };

  return monaco;
}

export default class Editor extends Component {
  state = {
    monaco: undefined
  };
  editor = undefined;

  componentDidMount() {
    initialize().then(monaco => this.setState({ monaco }));
  }

  getValue = () => {
    return this.editor.getValue();
  }

  render() {
    const { monaco } = this.state;
     const { 
      value='', 
      language='javascript',
      height=100,
      width=350,
    } = this.props;

     if (!monaco) { 
      return (
        <div style={{ width }}>
          <Dimmer active inverted>
            <Loader
              style={{ 
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontSize: 12
              }}
              inverted 
              content='Loading Editor' 
            />
          </Dimmer>
        </div>
      );
    }   

    return (
      <div>
        <div
          ref={container => {
            if (!this.root) {
              this.root = container;
              this.editor = monaco.editor.create(
                this.root, 
                {
                  value,
                  language
                }
              );
            }
          }}
          style={{
            border: 'solid 1px lightgray',
            textAlign: 'left',
            height,
            width,
          }}
        />
      </div>
    );
  }
}
   