import React, { Component } from 'react';
import {
  Input,
  Button,
  Label
} from 'semantic-ui-react';

import { configureService } from '../../core/actions';

export default class FileExchangeUI extends Component {
  state = {
    name: 'name'
  };

  componentDidMount() {
    if (this.state && this.state.name) {
      this.onNameChanged(this.state.name);
    }
  }

  onNameChanged = name => {
    if (this.changeNameTimer) {
      clearTimeout(this.changeNameTimer);
      this.changeNameTimer = undefined;
    }
    this.setState({ name });
    this.changeNameTimer = setTimeout(
      () => {
        this.updateExchangeName(name);
        this.changeNameTimer = undefined;
      }, 1000
    );
  }

  updateExchangeName = name => {
    const { service } = this.props;
    return configureService(service, { name });
  }

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
            onChange={(_, data) => this.onNameChanged(data.value)}
          />
        </div>

        <div
          style={{
            ...lineStyle,
            textAlign: 'center',
          }}
        >
          <div style={lineStyle}>

            <form
              action={`/api/${service.board}/${this.state.name}`}
              method="post"
              enctype="multipart/form-data"
            >
              <div
                className="container input"
                style={lineStyle}
              >
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
          <a href={`/api/${service.board}/${this.state.name}`}>
            <Button
              style={{
                width: 210,
              }}
            >
              Download
            </Button>
          </a>
        </div>
      </div>
    );
  }
}
