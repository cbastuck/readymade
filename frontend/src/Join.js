import React, { Component } from 'react';
import { Redirect } from 'react-router-dom';

import { joinBoard } from './core/actions';

export default class Join extends Component {
  state = {
    boardname: ''
  };

  joinBoard = async () => {
    const params = this.props && this.props.match && this.props.match.params;
    const { share } = params;
    if (share) {
      await joinBoard(share, share);
      this.setState({ boardname: share });
    } else {
      console.error('Can not join, share identifier missing');
    }
  }

  render() {
    const { boardname } = this.state;  
    if (!boardname) {
      this.joinBoard();
      return false;
    }

    return <Redirect to={`/${boardname}`} />;
  }
}