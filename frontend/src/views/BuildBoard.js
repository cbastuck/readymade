import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';
import g from 'unique-names-generator'

import { setCurrentBoardName } from '../core/actions';

class BuildBoard extends Component {
  render() {
    const name = g.generate('-');
    setCurrentBoardName(name);
    return <Redirect to={name} />;
  }
}
export default BuildBoard;
