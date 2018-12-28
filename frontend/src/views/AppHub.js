import React, { Component } from 'react';
import qs from 'querystring';

import {
  Input,
  Label
} from 'semantic-ui-react';

export default class AppHub extends Component {
  state = {
    email: ''
  };

  render() {
    const query = qs.parse(this.props.location.search.substr(1));
    const path = query.path || 'email';
    const board = this.props.match.params.board;
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
          action={`/api/${board}/${path}`}
          method="post"
          encType="application/x-www-form-urlencoded"
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
