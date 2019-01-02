import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import g from 'unique-names-generator'

class BuildBoard extends Component {
  render() {
    const name = g.generate('-');
    return <Redirect to={name} />;
  }
}
export default BuildBoard;
