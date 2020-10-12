import React, { Component } from 'react';
import { 
  Button,
  Checkbox,
  TextArea,
  Input,
} from 'semantic-ui-react';
 
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
    items: null,
    itemsSelection: [],
    rawText: '',
    singleLineRawText: true,
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
    const { items } = this.state;
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
    const { items, itemsSelection } = this.state;
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
            const dropName = isArray ? 'multiple files' : blob.name
            this.setState({ blob, dropName });
          }}
          onItems={items => this.setState({ items }) }
        />
        <Button
          style={this.buttonStyle}
          onClick={() => service.inject(
            itemsSelection.map(idx => items[idx]) 
          )}
          disabled={!itemsSelection.length}
        >
          Inject
        </Button>
      </div>
    );
  }

  renderRawInput = service => {
    const { singleLineRawText, rawText } = this.state;
    return (
      <div style={{ width: '100%' }}>
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
          <div
            style={{
              marginLeft: 'auto'
            }}
          >
            <Checkbox
              toggle
              checked={singleLineRawText}
              onChange={(_, { checked: singleLineRawText }) => this.setState({ singleLineRawText })}
            />
          </div>
        </div>
        { 
          !singleLineRawText ? 
            <TextArea 
              style={{ 
                width: '100%',
                padding: 10,
              }}
              value={rawText}
              onChange={(_, { value: rawText }) => this.setState({ rawText })}
            /> : 
            <Input 
              style={{ width: '100%' }}
              value={rawText}
              onChange={(_, { value: rawText }) => this.setState({ rawText })}
            />
        }
        <Button
          style={this.buttonStyle}
          onClick={() => service.inject(rawText)}
          disabled={!rawText}
        >
          Inject
        </Button>
      </div>
    );
  }

  renderStructuredData = service => {
    const { initialCode } = this.state;
    return (
      <div>
        < h1
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
            textAlign: 'left',
            margin: '4px 0px',
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

  render() {
    return (
      <ServiceUI 
        {...this.props} 
        onInit={this.onInit.bind(this)}
        segments={[
          { name: 'Drag and Drop', render: this.renderDragNDropInput },
          { name: 'Plain text', render: this.renderRawInput },
          { name: 'Structured Data', render: this.renderStructuredData },
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
