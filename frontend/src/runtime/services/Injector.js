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
import { Debouncer } from './helpers';

const serviceId = 'hookup.to/service/injector';
const serviceName = 'Injector';

class InjectorUI extends Component {
  state = {
    files: [],
    user: undefined,
    recentCode: JSON.stringify({ key: "value" }, null, 2),
    blob: null,
    dropName: undefined,
    items: null,
    itemsSelection: [],
    rawText: '',
    multirow: false,
    fileProgress: 0,
  };

  buttonStyle = {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    width: '100%',
    marginTop: 5,
  };

  componentDidMount() {
    this.debouncer = new Debouncer(100);
  }

  componentWillUnmount() {
    this.debouncer.clear();
  }

  onInit = initialState => {
    const { 
      rawText,
      recentCode,
    } = initialState;
    
    if (rawText !== undefined) {
      this.setState({ rawText });
    }

    if (recentCode !== undefined) {
      const code = typeof recentCode === 'string' ? 
        recentCode : 
        JSON.stringify(recentCode);
      this.setState({ recentCode: code });
    }
  }

  getDroppedItemLabels = () => {
    const { items, dropName } = this.state;
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
          { dropName ? dropName : 'Drop Zone' }
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
      <div 
        style={s(
          t.fill,
          { 
            display: 'flex',
            flexDirection: 'column'
          }
        )}
      >
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
          style={{ flexGrow: 2 }} 
          label={this.getDroppedItemLabels()}
          onFiles={files => {
            const isArray = files.length > 1;
            const blob = isArray ? 
                Array.from(files):
                files[0];
            const dropName = isArray ? 'multiple files' : blob.name;
            this.setState({ blob, dropName, items: null });
          }}
          onItems={items => this.setState({ items }) }
        />
        <Button
          style={this.buttonStyle}
          onClick={() => {
            if (blob) {
              this.readFile(service, blob, false)
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
    const { multirow, rawText } = this.state;
    return (
      <div 
        style={{ 
          height: '100%', 
          width: '100%', 
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
          }}
        >
          Enter plain text
        </h1>    
        <div 
          style={{ 
            flexGrow: 2, 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          { 
            multirow ? 
              <TextArea
                style={{
                  flexGrow: 2,
                  width: '100%',
                  padding: 10,
                  resize: 'none',
                  border: 'solid 1px #ccc'
                }}
                cols="20"
                value={rawText}
                onChange={(_, { value: rawText }) => {
                  service.configure({ rawText });
                  this.setState({ rawText })
                }}
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
          <div style={s(t.tl, t.mt3)}>
            <Checkbox
              style={s(t.fs12, t.uc, t.ls1, { margin: '5px 0px' })}
              toggle
              checked={multirow}
              onChange={(_, { checked: multirow }) => this.setState({ multirow })}
              label="Multirow"
            />
          </div>  
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
    const { recentCode } = this.state;
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
          value={recentCode}
          language="json"
          onChange={
            () => this.editor && this.debouncer.f(
              () => service.configure({ 
                recentCode: this.editor.getValue() 
              })
            )
          }
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

  readFile = (service, file, loadAsText) => {
    const reader = new FileReader();
    //reader.addEventListener('loadstart', ev => console.log('loadstart', reader.result));
    //reader.addEventListener('load', ev => console.log('load', reader.result));
    reader.addEventListener('error', ev => {
      console.log('Error Injector.readFile', reader.error)
    });
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
          flexDirection: 'column',
          textAlign: 'left'
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
          onClick={() => this.readFile(service, file, loadAsText)}
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
        onInit={this.onInit}
        segments={[
          { name: 'Text', render: this.renderRawInput },
          { name: 'JSON', render: this.renderStructuredData },
          { name: 'File', render: this.renderFileInput },
          { name: 'Drop', render: this.renderDragNDropInput },
        ]}
        initialSegment={service => service.recentCode ? 'JSON' : 'Text'}
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
    const { 
      rawText,
      recentCode,
    } = config;

    if (rawText !== undefined) {
      this.rawText = rawText;
    }

    if (recentCode !== undefined) {
      this.recentCode = recentCode;
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
