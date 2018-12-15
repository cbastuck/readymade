import React, { Component } from 'react';
import {
  Dropdown,
  Input,
  Button,
  Label,
  Header
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class extends Component {
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
          <Label>
            Method
          </Label>
          <Dropdown
            className="left"
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
          <Label>Path</Label>
          <Input
            placeholder='Path'
            value={this.state.path}
            style={{ width: '75%' }}
            onChange={(_, data) => this.setState({ path: data.value })}
          />
        </div>

        {
          this.state.op === 'GET' && (
            <div
              style={lineStyle}
            >
              <Label>Query</Label>
              <Input
                placeholder='Param'
                value={this.state.selector.query}
                style={{ width: '75%' }}
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

        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <Button
            style={{ width: '95%' }}
            onClick={async () => {
              const config = await configureService(service, this.state);
              this.setState({ ...config });
            }}
          >
            Configure
          </Button>
        </div>

        {
          this.state.op === 'GET' &&
          this.state.running && (
            <div
              style={{
                ...lineStyle,
                textAlign: 'right',
                margin: '1px 10px',
            }}>
              <a
                href={`/api/${service.board}/${this.state.path}?${this.state.selector.query}=test`}
                target="blank"
              >
                test
              </a>
            </div>
          )
        }
      </div>
   );
  }
}
