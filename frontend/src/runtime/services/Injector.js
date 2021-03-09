import React, { Component } from 'react';
import { 
  Button,
  Checkbox,
  TextArea,
  Input,
  Progress,
} from 'semantic-ui-react';
 
import { s, t } from '../../styles';
import ServiceUI from './ServiceUI';
import Editor from '../../components/shared/Editor/index';
import DropZone from '../../components/shared/DropZone';

const serviceId = 'hookup.to/service/injector';
const serviceName = 'Injector';

class InjectorUI extends Component {
  state = {
    files: [],
    user: undefined,
    initialCode: JSON.stringify({ key: "value" }, null, 2),
    blob: null,
    dropName: undefined,
    items: null,
    itemsSelection: [],
    rawText: '',
    singleLineRawText: true,
    fileProgress: 0,
  };

  buttonStyle = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: '100%',
    marginTop: 5,
  };

  onInit = service => {
    this.service = service;
  }

  getDroppedItemLabels = () => {
    const { items } = this.state;
    if (!items) {
      return (
        <div
          style={{
            width: '100%',
            minHeight: 80,
            paddingTop: 30,
            fontSize: 20,
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontWeight: 'bold',
          }}
        >
          Drop Zone
          </div>
      );
    }
    return (
      <ul 
        style={{
          textAlign: 'left',
          listStyleType: 'none',
          paddingLeft: 15
        }}
      >
        { 
          items.map((item, idx) => (
            <li 
              key={`drop-zone-item-${idx}`}
            >
              <div 
                style={{
                  display: 'flex', 
                  flexDirection: 'row',
                  marginBottom: 3,
                }}
              >
                <Checkbox
                  key={`drop-zone-item-checkbox-${idx}`}
                  onChange={(_, { checked }) => this.setState({ 
                    itemsSelection: 
                      checked ? 
                        [...this.state.itemsSelection, idx] : 
                        this.state.itemsSelection.filter(x => x !== idx)
                    })
                  }
                />
                <div 
                  style={{ 
                    marginLeft: 5, 
                    marginTop: -2,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    fontSize: 12,
                  }}
                > 
                  { item.type } 
                </div>
              </div>
            </li>
          ))
        }
      </ul>
    );
  }

  renderDragNDropInput = service => {
    const { items, itemsSelection, blob, dropName } = this.state;
    return (
      <div style={{ width: '100%' }}>
        <h1
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
            textAlign: 'left',
            margin: '4px 0px',
          }}
        >
          Drop something below 
        </h1>
        <DropZone 
          label={this.getDroppedItemLabels()}
          onFiles={files => {
            const isArray = files.length > 1;
            const blob = isArray ? 
                Array.from(files):
                files[0];
            const dropName = isArray ? 'multiple files' : blob.name;
            this.setState({ blob, dropName });
          }}
          onItems={items => this.setState({ items }) }
        />
        <Button
          style={this.buttonStyle}
          onClick={() => {
            if (blob) {
              service.inject(blob);
            } else {
              service.inject(itemsSelection.map(idx => items[idx]));
            }
          }}
          disabled={!itemsSelection.length && !(blob || dropName)}
        >
          Inject
        </Button>
      </div>
    );
  }

  renderRawInput = service => {
    const { singleLineRawText, rawText } = this.state;
    return (
      <div 
        style={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <h1
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 1,
              textAlign: 'left',
              margin: '4px 0px',
            }}
          >
            {
              singleLineRawText ? 
                'Enter single line below' : 
                'Enter multi row text below'
            }
          </h1>
          <div style={{ marginLeft: 'auto' }}>
            <Checkbox
              style={{ marginLeft: 10 }}
              toggle
              checked={singleLineRawText}
              onChange={(_, { checked: singleLineRawText }) => this.setState({ singleLineRawText })}
            />
          </div>
        </div>
        <div 
          style={{ 
            flexGrow: 2, 
            display: 'flex', 
            flexDirection: 'column' 
            }}
          >
          { 
            !singleLineRawText ? 
              <TextArea 
                style={{
                  flexGrow: 2,
                  width: '100%',
                  padding: 10,
                  resize: 'none',
                }}
                value={rawText}
                onChange={(_, { value: rawText }) => this.setState({ rawText })}
              /> : 
              <Input 
                style={{ width: '100%' }}
                value={rawText}
                onChange={(_, { value: rawText }) => this.setState({ rawText })}
                placeholder="Enter text here"
                onKeyUp={ev => {
                  switch(ev.key) {
                    case 'Enter':
                      return service.inject(rawText);
                    default:
                      break;
                  }
                }}
              />
          }
          <Button
            style={{ ...this.buttonStyle }}
            onClick={() => service.inject(rawText)}
            disabled={!rawText}
          >
            Inject
          </Button>
        </div>
      </div>
    );
  }

  renderStructuredData = service => {
    const { initialCode } = this.state;
    return (
      <div 
        style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        <h1
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
            textAlign: 'left',
            margin: '4px 0px',
            width: '100%',
          }}
        >
          Input text below
        </h1>
        <Editor 
          ref={editor => this.editor = editor}
          value={initialCode}
          language="json"
        />
        <Button
          style={this.buttonStyle}
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

  renderFileInput = service => {
    const { 
      file,
      loadAsText,
      fileProgress,
    } = this.state;
    return (
      <div 
        style={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        <div style={t.m(0, 10)}>
          <input 
            style={s(t.uc, t.fs12)}
            type="file" 
            onChange={ev => this.setState({ file: ev.target.files[0] })}
          />
        </div>
        <Checkbox
          style={s(t.fs12, t.uc, t.ls1)}
          label="read as text"
          checked={loadAsText}
          onChange={(_, { checked: loadAsText }) => this.setState({ loadAsText })}
          toggle
        />
        <Button
          style={this.buttonStyle}
          disabled={!file}
          onClick={() => {
            const reader = new FileReader();
            //reader.addEventListener('loadstart', ev => console.log('loadstart', reader.result));
            //reader.addEventListener('load', ev => console.log('load', reader.result));
            //reader.addEventListener('error', ev => console.log('error', reader.result));
            //reader.addEventListener('abort', ev => console.log('abort', reader.result));
            reader.addEventListener('loadend', ev => {
              const result = loadAsText ? 
                reader.result : 
                new Blob([reader.result], { type : 'application/octet-stream'});
              service.app.next(service, result);
              this.setState({ fileProgress: 0 });
            });
            reader.addEventListener('progress', ev => {
              const fileProgress = Math.round((ev.loaded / ev.total) * 100);
              this.setState({ fileProgress });
            });
            if (loadAsText) {
              reader.readAsText(file);
            } else {
              reader.readAsArrayBuffer(file);
            }
          }}
        >
          Inject
        </Button>
        <div 
          style={s(
            t.m(0, 3), 
            { display: fileProgress <= 0 && 'none'}
          )}>
          <Progress
            progress="percent"
            percent={fileProgress} 
          />
        </div>
      </div>
    );
  }

  render() {
    return (
      <ServiceUI
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'DragDrop', render: this.renderDragNDropInput },
          { name: 'Text', render: this.renderRawInput },
          { name: 'JSON', render: this.renderStructuredData },
          { name: 'File', render: this.renderFileInput },
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

    this.mode='dragndrop';
  }

  configure(config) { 
    const { mode } = config;
    if (mode !== undefined) {
      this.mode = mode;
    }
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
