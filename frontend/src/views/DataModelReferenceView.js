import React, { Component } from 'react';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';

import DataModelReference from '../components/DataModelReference';

export default class DataModelReferenceView extends Component {
  render() {
    const { match } = this.props;
    const { params } = match || {};
    const { name } = params || {};
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.user && !!appContext.user.username}
            >
              <BoardConsumer>
              {
                boardContext => (
                  <div style={{ height: '100%' }}>
                    <Toolbar 
                      onAction={boardContext.onAction}
                    />
                    <DataModelReference name={name} />
                  </div>
                )
              }
              </BoardConsumer>
              <Footer />
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}