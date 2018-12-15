import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import g from 'unique-names-generator'

class BuildBoard extends Component {
  render() {
    return <Redirect to={g.generate('-')} />;
  }
}
export default BuildBoard;
