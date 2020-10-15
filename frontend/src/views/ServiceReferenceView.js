import React, { Component } from 'react';

import { AppConsumer } from '../AppContext';
import BoardContext, { BoardConsumer } from '../BoardContext';
import Toolbar from '../components/Toolbar';
import Footer from '../components/Footer';
import ServiceReference from '../components/ServiceReference';

export default class ServiceReferenceView extends Component {
  
  getServiceId = () => {
    const { match } = this.props;
    const { params } = match || {};
    const { service } = params || {};
    return service;
  }

  render() {
    const serviceId = this.getServiceId();
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.user && !!appContext.user.username}
            >
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '100%',
                }}
              >
                <BoardConsumer>
                {
                  boardContext => (
                    <div style={{ height: '100%' }}>
                      <Toolbar 
                        savedBoards={boardContext.savedBoards}
                        onAction={boardContext.onAction}
                      />
                      <ServiceReference serviceId={serviceId} />
                    </div>
                  )
                }
                </BoardConsumer>
                <Footer flex />
              </div>
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}