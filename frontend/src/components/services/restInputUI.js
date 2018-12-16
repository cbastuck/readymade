import React, { Component } from 'react';
import {
  Dropdown,
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class RestInputUI extends Component {
  constructor(props) {
    super(props);

    const { service } = props;
    const board = service && service.board;
    const op = service && service.op && service.op.toUpperCase();
    const path = service && service.path && service.path.split(`${board}/`)[1];
    const query = service && service.selector && service.selector.query;
    this.state = {
      op: op || 'GET',
      path: path || 'email',
      selector: {
        query: query || 'in'
      },
      running: op && path
    }
  }

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
    };

    return (
      <div>
        <div
          style={lineStyle}
        >
          <Label
            style={{ width: 60 }}
          >
            Method
          </Label>
          <Dropdown
            className="left"
            style={{ marginLeft: 5 }}
            placeholder='Operation'
            options={[
              { key: 'GET', value: 'GET', text: 'GET' },
              { key: 'POST', value: 'POST', text: 'POST' },
              { key: 'DELETE', value: 'DELETE', text: 'DELETE' },
              { key: 'PUT', value: 'PUT', text: 'PUT' },
            ]}
            value={this.state.op}
            onChange={(_ev, data) => this.setState({ op: data.value })}
          />
        </div>

        <div
          style={lineStyle}
        >
          <Label
            style={{ width: 60 }}
          >Path</Label>
          <Input
            placeholder='Path'
            value={this.state.path}
            style={{ width: 160 }}
            onChange={(_, data) => this.setState({ path: data.value })}
          />
        </div>

        {
          this.state.op === 'GET' && (
            <div
              style={{ ...lineStyle }}
            >
              <Label
                style={{ width: 60 }}
              >
                Query
              </Label>
              <Input
                placeholder='Param'
                value={this.state.selector.query}
                style={{ width: 160 }}
                onChange={(_, data) => this.setState({
                  selector: {
                    ...this.state.selector,
                    query: data.value
                  }})
                }
              />
            </div>
          )
        }

        {
          this.state.op === 'GET' &&
          this.state.running && (
            <div
              style={{
                ...lineStyle,
                textAlign: 'right',
                margin: '10px 10px',
            }}>
              <a
                href={`/api/${service.board}/${this.state.path}?${this.state.selector.query}=test`}
                target="blank"
                style={{
                  color: 'black',
                  padding: 5
                }}
              >
                Click to test
              </a>
            </div>
          )
        }

        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Button
            style={{ width: 210 }}
            onClick={async () => {
              const config = await configureService(service, this.state);
              this.setState({ ...config });
            }}
          >
            Configure
          </Button>
        </div>
      </div>
   );
  }
}
