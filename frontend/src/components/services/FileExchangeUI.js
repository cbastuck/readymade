import React, { Component } from 'react';
import {
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class FileExchangeUI extends Component {
  state = {
    name: 'ex'
  };

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: 'left',
      marginBottom: 10,
    };
    return (
      <div
        style={lineStyle}
      >
        <div
          style={lineStyle}
        >
          <Label style={{ width: 60 }}>
            Name
          </Label>
          <Input
            placeholder='Name of Exchange'
            value={this.state.name}
            style={{ width: 160 }}
            onChange={(_, data) => this.setState({ name: data.value })}
          />
        </div>

        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <div style={lineStyle}>
            <Label style={{ width: 60 }}>File</Label>
            <form
              action={`/api/${service.board}/${this.state.name}`}
              method="post"
              enctype="multipart/form-data"
            >
              <div class="ui container action input">
                  <input type="file" name="file"/>
              </div>
              <div
                style={{
                  ...lineStyle,
                  textAlign: 'center',
                }}
              >
                <Button
                  type="submit"
                  style={{
                    width: 210,
                    marginTop: 10,
                  }}
                >
                  Upload
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}>
          <a href={`/api/${service.board}/${this.state.name}`}>Download</a>
        </div>

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
