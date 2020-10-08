import React, { Component } from 'react';

import * as monaco from 'monaco-editor';

import require from './loader.min';

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

export default class Editor extends Component {
    getValue = () => {
      return this.editor.getValue();
    }

    render() {
      const { 
        value='', 
        language='javascript',
        height=100,
        width=350,
      } = this.props;

      return (
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
            textAlign: 'left',
            height,
            width,
          }}
        />
      );
  }
}
   