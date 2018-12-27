import React, { Component } from 'react';

import {
  Input,
  Label
} from 'semantic-ui-react';

export default class AppHub extends Component {
  state = {
    email: ''
  };

  render() {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          padding: 5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <form
          action="/api/popular-amber-skunk/email"
          method="post"
          enctype="application/x-www-form-urlencoded"
        >
          <Label>
            Email
          </Label>
          <Input
            name="email"
            value={this.state.email}
            onChange={(_, { value }) => this.setState({ email: value })}
          />
        </form>
      </div>
    );
  }
}
